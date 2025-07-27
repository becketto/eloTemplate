import { createCookieSessionStorage } from "react-router"
import type { Route } from "./+types/compare"
import { db } from "~/db.server"

export async function loader({ request }: Route.LoaderArgs) {
    // Add cache headers for better performance
    const headers = new Headers()
    headers.set("Cache-Control", "private, max-age=0, must-revalidate")

    // More efficient random selection for large datasets
    const totalImages = await db.image.count()

    if (totalImages < 2) {
        throw new Error("Need at least 2 images in database")
    }

    // Use more efficient random selection for larger datasets
    const randomOffset1 = Math.floor(Math.random() * totalImages)
    let randomOffset2 = Math.floor(Math.random() * totalImages)

    // Ensure different offsets
    while (randomOffset2 === randomOffset1) {
        randomOffset2 = Math.floor(Math.random() * totalImages)
    }

    // Get two random images efficiently
    const [imageA, imageB] = await Promise.all([
        db.image.findFirst({
            skip: randomOffset1,
            select: {
                id: true,
                name: true,
                url: true,
                elo: true
            }
        }),
        db.image.findFirst({
            skip: randomOffset2,
            select: {
                id: true,
                name: true,
                url: true,
                elo: true
            }
        })
    ])

    if (!imageA || !imageB) {
        throw new Error("Failed to load images")
    }

    return {
        imageA,
        imageB
    }
}

// Session storage for tracking user sessions
const sessionStorage = createCookieSessionStorage({
    cookie: {
        name: "__session",
        secrets: [process.env.SESSION_SECRET || "default-secret-change-in-production"],
        sameSite: "lax",
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 7, // 7 days
    },
})

// Rate limiting maps
const rateLimitMap = new Map<string, { requests: number[], lastCleanup: number }>()
const sessionRateLimitMap = new Map<string, { requests: number[], lastCleanup: number }>()

// Enhanced cleanup function for both IP and session rate limiting
function cleanupRateLimit() {
    const now = Date.now()
    const cleanupInterval = 5 * 60 * 1000 // 5 minutes

    // Cleanup IP-based rate limiting
    for (const [key, data] of rateLimitMap.entries()) {
        if (now - data.lastCleanup > cleanupInterval) {
            data.requests = data.requests.filter(time => now - time < 60 * 1000)
            data.lastCleanup = now

            if (data.requests.length === 0) {
                rateLimitMap.delete(key)
            }
        }
    }

    // Cleanup session-based rate limiting
    for (const [key, data] of sessionRateLimitMap.entries()) {
        if (now - data.lastCleanup > cleanupInterval) {
            data.requests = data.requests.filter(time => now - time < 60 * 1000)
            data.lastCleanup = now

            if (data.requests.length === 0) {
                sessionRateLimitMap.delete(key)
            }
        }
    }
}

export async function action({ request }: Route.ActionArgs) {
    const formData = await request.formData()
    const winnerId = Number(formData.get("winnerId"))
    const loserId = Number(formData.get("loserId"))

    // Basic validation
    if (isNaN(winnerId) || isNaN(loserId) || winnerId === loserId) {
        throw new Error("Invalid image IDs")
    }

    // Get or create session
    const session = await sessionStorage.getSession(request.headers.get("Cookie"))
    let sessionId = session.get("sessionId")

    if (!sessionId) {
        sessionId = crypto.randomUUID()
        session.set("sessionId", sessionId)
    }

    // Enhanced dual rate limiting (IP + Session)
    const clientIP = request.headers.get("x-forwarded-for")?.split(',')[0] ||
        request.headers.get("x-real-ip") ||
        request.headers.get("cf-connecting-ip") ||
        "unknown"

    const now = Date.now()
    const windowMs = 60 * 1000 // 1 minute
    const maxRequestsPerIP = 30 // IP-based limit
    const maxRequestsPerSession = 20 // More restrictive session-based limit

    // Cleanup old entries periodically
    if (Math.random() < 0.1) { // 10% chance to cleanup
        cleanupRateLimit()
    }

    // Check IP-based rate limiting
    if (!rateLimitMap.has(clientIP)) {
        rateLimitMap.set(clientIP, { requests: [], lastCleanup: now })
    }

    const ipRateData = rateLimitMap.get(clientIP)!
    const recentIPRequests = ipRateData.requests.filter(time => now - time < windowMs)

    if (recentIPRequests.length >= maxRequestsPerIP) {
        throw new Response("Rate limit exceeded. Please slow down.", { status: 429 })
    }

    // Check session-based rate limiting
    if (!sessionRateLimitMap.has(sessionId)) {
        sessionRateLimitMap.set(sessionId, { requests: [], lastCleanup: now })
    }

    const sessionRateData = sessionRateLimitMap.get(sessionId)!
    const recentSessionRequests = sessionRateData.requests.filter(time => now - time < windowMs)

    if (recentSessionRequests.length >= maxRequestsPerSession) {
        throw new Response("Rate limit exceeded for this session. Please slow down.", { status: 429 })
    }

    // Update both rate limiting trackers
    recentIPRequests.push(now)
    ipRateData.requests = recentIPRequests

    recentSessionRequests.push(now)
    sessionRateData.requests = recentSessionRequests

    // Optimized database transaction with error handling
    try {
        const [winner, loser] = await Promise.all([
            db.image.findUnique({
                where: { id: winnerId },
                select: { id: true, elo: true }
            }),
            db.image.findUnique({
                where: { id: loserId },
                select: { id: true, elo: true }
            })
        ])

        if (!winner || !loser) {
            throw new Error("Images not found")
        }

        // Calculate new Elo ratings
        const K = 32 // K-factor
        const expectedWinner = 1 / (1 + Math.pow(10, (loser.elo - winner.elo) / 400))
        const expectedLoser = 1 - expectedWinner

        const newWinnerElo = Math.max(0, winner.elo + K * (1 - expectedWinner))
        const newLoserElo = Math.max(0, loser.elo + K * (0 - expectedLoser))

        // Atomic update with optimized transaction
        await db.$transaction([
            db.image.update({
                where: { id: winnerId },
                data: { elo: newWinnerElo }
            }),
            db.image.update({
                where: { id: loserId },
                data: { elo: newLoserElo }
            })
        ])

        // Return response with updated session cookie
        const headers = new Headers()
        headers.set("Set-Cookie", await sessionStorage.commitSession(session))

        return Response.json({ success: true }, { headers })
    } catch (error) {
        console.error("Database error:", error)
        throw new Error("Failed to update ratings. Please try again.")
    }
} 