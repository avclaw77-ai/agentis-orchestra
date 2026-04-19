import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { taskAttachments, tasks } from "@/db/schema"
import { eq, asc } from "drizzle-orm"
import { getSessionUser } from "@/lib/auth"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "task-attachments")

// GET /api/tasks/[id]/attachments
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { id } = await params

  const attachments = await db
    .select()
    .from(taskAttachments)
    .where(eq(taskAttachments.taskId, id))
    .orderBy(asc(taskAttachments.createdAt))

  return NextResponse.json(attachments)
}

// POST /api/tasks/[id]/attachments
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { id } = await params

  if (!/^TASK-[A-Z0-9]+$/i.test(id)) {
    return NextResponse.json(
      { error: "Invalid task ID format" },
      { status: 400 }
    )
  }

  const body = await req.json()
  const { filename, content, mimeType, size } = body

  if (!filename || !content) {
    return NextResponse.json(
      { error: "filename and content are required" },
      { status: 400 }
    )
  }

  // Size limit: 10MB max
  const MAX_SIZE = 10 * 1024 * 1024
  const estimatedSize = Math.ceil((content.length * 3) / 4) // base64 -> bytes
  if (estimatedSize > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 10MB." },
      { status: 413 }
    )
  }

  // Verify task exists
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id))
  if (!task) {
    return NextResponse.json({ error: "task not found" }, { status: 404 })
  }

  // Write file to disk
  const taskDir = path.join(UPLOAD_DIR, id)
  await mkdir(taskDir, { recursive: true })

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_")
  const timestamp = Date.now()
  const filePath = path.join(taskDir, `${timestamp}-${safeName}`)
  const relativePath = path.relative(process.cwd(), filePath)

  const buffer = Buffer.from(content, "base64")
  await writeFile(filePath, buffer)

  const [attachment] = await db
    .insert(taskAttachments)
    .values({
      taskId: id,
      filename,
      path: relativePath,
      size: size || buffer.length,
      mimeType: mimeType || null,
      uploadedBy: user.id,
    })
    .returning()

  return NextResponse.json(attachment, { status: 201 })
}
