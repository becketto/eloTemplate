import { type LoaderFunctionArgs } from "react-router"
import fs from "fs"
import path from "path"

export async function loader({ params }: LoaderFunctionArgs) {
    const filename = params["*"] // Get the filename from the URL

    if (!filename) {
        throw new Response("Not Found", { status: 404 })
    }

    const filePath = path.join("/Volumes/T7/optimized", filename)

    // Check if file exists and is within the allowed directory
    if (!fs.existsSync(filePath)) {
        throw new Response("Not Found", { status: 404 })
    }

    // Security check - ensure the path is within the allowed directory
    const realPath = fs.realpathSync(filePath)
    const allowedDir = fs.realpathSync("/Volumes/T7/optimized")

    if (!realPath.startsWith(allowedDir)) {
        throw new Response("Forbidden", { status: 403 })
    }

    // Read the file
    const fileBuffer = fs.readFileSync(filePath)

    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase()
    const contentType = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
        '.svg': 'image/svg+xml'
    }[ext] || 'application/octet-stream'

    return new Response(fileBuffer, {
        headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        },
    })
} 