import { useState, useEffect, useRef } from "react"
import { Box, Button, Heading, Image, VStack, HStack, Text, Spinner, Center, IconButton } from "@chakra-ui/react"
import { Form, useNavigation, Link } from "react-router"
import type { Route } from "./+types/compare"
import { db } from "~/db.server"
import { useColorModeValue } from "~/components/ui/color-mode"
import { FaArrowLeft } from "react-icons/fa"

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

// Upgraded rate limiting with Redis-like behavior using Map with cleanup
const rateLimitMap = new Map<string, { requests: number[], lastCleanup: number }>()

// Cleanup old entries periodically
function cleanupRateLimit() {
  const now = Date.now()
  const cleanupInterval = 5 * 60 * 1000 // 5 minutes

  for (const [key, data] of rateLimitMap.entries()) {
    if (now - data.lastCleanup > cleanupInterval) {
      data.requests = data.requests.filter(time => now - time < 60 * 1000)
      data.lastCleanup = now

      // Remove empty entries
      if (data.requests.length === 0) {
        rateLimitMap.delete(key)
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

  // Enhanced rate limiting for hundreds of users
  const clientIP = request.headers.get("x-forwarded-for")?.split(',')[0] ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  const now = Date.now()
  const windowMs = 60 * 1000 // 1 minute
  const maxRequests = 30 // Increased for better UX

  // Cleanup old entries periodically
  if (Math.random() < 0.1) { // 10% chance to cleanup
    cleanupRateLimit()
  }

  if (!rateLimitMap.has(clientIP)) {
    rateLimitMap.set(clientIP, { requests: [], lastCleanup: now })
  }

  const rateData = rateLimitMap.get(clientIP)!
  const recentRequests = rateData.requests.filter(time => now - time < windowMs)

  if (recentRequests.length >= maxRequests) {
    throw new Response("Rate limit exceeded. Please slow down.", { status: 429 })
  }

  recentRequests.push(now)
  rateData.requests = recentRequests

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

    return Response.json({ success: true })
  } catch (error) {
    console.error("Database error:", error)
    throw new Error("Failed to update ratings. Please try again.")
  }
}

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Image Comparison - Elo Rating" },
    { name: "description", content: "Compare images and rate them using Elo system" },
  ]
}

export default function Compare({ loaderData }: Route.ComponentProps) {
  const { imageA, imageB } = loaderData
  const navigation = useNavigation()
  const isSubmitting = navigation.state === "submitting"
  const bgColor = ""
  const textColor = "white"
  const subTextColor = "gray.400"
  const borderColor = "gray.600"
  const hoverBorderColor = "gray.400"

  // Refs for form submissions
  const formARef = useRef<HTMLFormElement>(null)
  const formBRef = useRef<HTMLFormElement>(null)

  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (isSubmitting) return

      if (event.key === '1') {
        event.preventDefault()
        formARef.current?.requestSubmit()
      } else if (event.key === '2') {
        event.preventDefault()
        formBRef.current?.requestSubmit()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isSubmitting])

  if (isSubmitting) {
    return (
      <Center h="100vh">
        <VStack>
          <Spinner size="xl" color="blue.400" />
          <Text color={textColor}>Updating ratings...</Text>
        </VStack>
      </Center>
    )
  }

  return (
    <Box p="10" maxW="6xl" mx="auto" minH="100vh" bg={bgColor} position="relative">
      <VStack spacing="8">
        <HStack w="full" justifyContent="space-between" alignItems="center">
          <IconButton
            as={Link}
            to="/"
            variant="ghost"
            color={textColor}
            _hover={{ bg: "gray.700" }}
          >
            <FaArrowLeft />
          </IconButton>
          <Heading fontWeight="light" textAlign="center" color={textColor} flex="1">
            Which image is better?
          </Heading>
          <Box w="120px" /> {/* Spacer for centering the heading */}
        </HStack>

        <HStack spacing="8" alignItems="flex-start" flexWrap="wrap" justifyContent="center">
          <VStack spacing="4" flex="1" minW="300px" maxW="600px">
            <Form method="post" style={{ width: "100%" }}>
              <input type="hidden" name="winnerId" value={imageA.id} />
              <input type="hidden" name="loserId" value={imageB.id} />

              <Box
                as="button"
                borderWidth="2px"
                borderColor={borderColor}
                borderRadius="lg"
                overflow="hidden"
                cursor="pointer"
                transition="transform 0.2s"
                _hover={{ transform: "scale(1.02)", borderColor: hoverBorderColor }}
                w="full"
                p="0"
                bg="transparent"
              >
                <Image
                  src={imageA.url}
                  alt={imageA.name}
                  maxW="100%"
                  maxH={{ base: "40vh", md: "60vh" }}
                  height="auto"
                  objectFit="contain"
                  loading="lazy"
                />
              </Box>
            </Form>

            <VStack spacing="2">
              <Text fontSize="sm" color={subTextColor}>
                Elo: {Math.round(imageA.elo)}
              </Text>

              <Form method="post" ref={formARef}>
                <input type="hidden" name="winnerId" value={imageA.id} />
                <input type="hidden" name="loserId" value={imageB.id} />
                <Button
                  type="submit"
                  colorScheme="blue"
                  size="lg"
                  disabled={isSubmitting}
                >
                  Choose This One
                </Button>
              </Form>
            </VStack>
          </VStack>

          <VStack spacing="4" flex="1" minW="300px" maxW="600px">
            <Form method="post" style={{ width: "100%" }}>
              <input type="hidden" name="winnerId" value={imageB.id} />
              <input type="hidden" name="loserId" value={imageA.id} />

              <Box
                as="button"
                borderWidth="2px"
                borderColor={borderColor}
                borderRadius="lg"
                overflow="hidden"
                cursor="pointer"
                transition="transform 0.2s"
                _hover={{ transform: "scale(1.02)", borderColor: hoverBorderColor }}
                w="full"
                p="0"
                bg="transparent"
              >
                <Image
                  src={imageB.url}
                  alt={imageB.name}
                  maxW="100%"
                  maxH={{ base: "40vh", md: "60vh" }}
                  height="auto"
                  objectFit="contain"
                  loading="lazy"
                />
              </Box>
            </Form>

            <VStack spacing="2">
              <Text fontSize="sm" color={subTextColor}>
                Elo: {Math.round(imageB.elo)}
              </Text>

              <Form method="post" ref={formBRef}>
                <input type="hidden" name="winnerId" value={imageB.id} />
                <input type="hidden" name="loserId" value={imageA.id} />
                <Button
                  type="submit"
                  colorScheme="blue"
                  size="lg"
                  disabled={isSubmitting}
                >
                  Choose This One
                </Button>
              </Form>
            </VStack>
          </VStack>
        </HStack>

        <Button
          variant="outline"
          onClick={() => window.location.reload()}
          disabled={isSubmitting}
          color={textColor}
          borderColor={subTextColor}
          _hover={{ bg: subTextColor, color: bgColor }}
        >
          Skip This Comparison
        </Button>
      </VStack>

      {/* Subtle keyboard shortcut indicator in bottom right - desktop only */}
      <Box
        position="fixed"
        bottom="4"
        right="4"
        fontSize="xs"
        color="gray.600"
        fontFamily="mono"
        userSelect="none"
        display={{ base: "none", md: "block" }}
      >
        Press 1 or 2
      </Box>
    </Box>
  )
} 