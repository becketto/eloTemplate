import { useState } from "react"
import { Box, Button, Heading, Image, VStack, HStack, Text, Spinner, Center } from "@chakra-ui/react"
import { Form, useNavigation } from "react-router"
import type { Route } from "./+types/compare"
import { db } from "~/db.server"

export async function loader() {
  // Get two random images for comparison using more efficient approach
  const totalImages = await db.image.count()

  if (totalImages < 2) {
    throw new Error("Need at least 2 images in database")
  }

  // Get two different random images in a single query for efficiency
  const randomImages = await db.image.findMany({
    take: Math.min(10, totalImages), // Get more than needed to avoid duplicates
    orderBy: {
      id: 'asc'
    },
    skip: Math.floor(Math.random() * Math.max(0, totalImages - 10))
  })

  // Shuffle and pick first two different images
  const shuffled = randomImages.sort(() => 0.5 - Math.random())
  let imageA = shuffled[0]
  let imageB = shuffled.find(img => img.id !== imageA.id) || shuffled[1]

  // Fallback: if still same, get another image
  if (imageA.id === imageB.id && totalImages > 1) {
    const [altImage] = await db.image.findMany({
      where: { id: { not: imageA.id } },
      take: 1,
      orderBy: { id: 'asc' },
      skip: Math.floor(Math.random() * (totalImages - 1))
    })
    imageB = altImage
  }

  return {
    imageA,
    imageB
  }
}

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, number[]>()

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  const winnerId = Number(formData.get("winnerId"))
  const loserId = Number(formData.get("loserId"))

  // Basic validation
  if (isNaN(winnerId) || isNaN(loserId) || winnerId === loserId) {
    throw new Error("Invalid image IDs")
  }

  // Simple rate limiting (10 votes per minute per IP)
  const clientIP = request.headers.get("x-forwarded-for") || "unknown"
  const now = Date.now()
  const windowMs = 60 * 1000 // 1 minute
  const maxRequests = 20

  if (!rateLimitMap.has(clientIP)) {
    rateLimitMap.set(clientIP, [])
  }

  const requests = rateLimitMap.get(clientIP)!
  const recentRequests = requests.filter(time => now - time < windowMs)

  if (recentRequests.length >= maxRequests) {
    throw new Error("Rate limit exceeded. Please slow down.")
  }

  recentRequests.push(now)
  rateLimitMap.set(clientIP, recentRequests)

  // Get current images
  const [winner, loser] = await Promise.all([
    db.image.findUnique({ where: { id: winnerId } }),
    db.image.findUnique({ where: { id: loserId } })
  ])

  if (!winner || !loser) {
    throw new Error("Images not found")
  }

  // Calculate new Elo ratings
  const K = 32 // K-factor
  const expectedWinner = 1 / (1 + Math.pow(10, (loser.elo - winner.elo) / 400))
  const expectedLoser = 1 - expectedWinner // More efficient than recalculating

  const newWinnerElo = Math.max(0, winner.elo + K * (1 - expectedWinner)) // Prevent negative ratings
  const newLoserElo = Math.max(0, loser.elo + K * (0 - expectedLoser))

  // Update ratings in database (atomically)
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

  return { success: true }
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

  if (isSubmitting) {
    return (
      <Center h="100vh">
        <VStack>
          <Spinner size="xl" />
          <Text>Updating ratings...</Text>
        </VStack>
      </Center>
    )
  }

  return (
    <Box p="10" maxW="6xl" mx="auto">
      <VStack spaceY="8">
        <Heading fontWeight="light" textAlign="center">
          Which image is better?
        </Heading>

        <HStack spaceX="8" alignItems="stretch">
          <VStack spaceY="4" flex="1">
            <Form method="post" style={{ width: "100%" }}>
              <input type="hidden" name="winnerId" value={imageA.id} />
              <input type="hidden" name="loserId" value={imageB.id} />

              <Box
                as="button"
                borderWidth="2px"
                borderColor="gray.200"
                borderRadius="lg"
                overflow="hidden"
                cursor="pointer"
                transition="transform 0.2s"
                _hover={{ transform: "scale(1.02)" }}
                w="full"
                p="0"
                bg="transparent"
              >
                <Image
                  src={imageA.url}
                  alt={imageA.name}
                  w="400px"
                  h="300px"
                  objectFit="cover"
                  loading="lazy"
                />
              </Box>
            </Form>

            <VStack spaceY="2">
              <Text fontWeight="semibold">{imageA.name}</Text>
              <Text fontSize="sm" color="gray.600">
                Elo: {Math.round(imageA.elo)}
              </Text>

              <Form method="post">
                <input type="hidden" name="winnerId" value={imageA.id} />
                <input type="hidden" name="loserId" value={imageB.id} />
                <Button
                  type="submit"
                  colorScheme="blue"
                  size="lg"
                >
                  Choose This One
                </Button>
              </Form>
            </VStack>
          </VStack>

          <VStack spaceY="4" flex="1">
            <Form method="post" style={{ width: "100%" }}>
              <input type="hidden" name="winnerId" value={imageB.id} />
              <input type="hidden" name="loserId" value={imageA.id} />

              <Box
                as="button"
                borderWidth="2px"
                borderColor="gray.200"
                borderRadius="lg"
                overflow="hidden"
                cursor="pointer"
                transition="transform 0.2s"
                _hover={{ transform: "scale(1.02)" }}
                w="full"
                p="0"
                bg="transparent"
              >
                <Image
                  src={imageB.url}
                  alt={imageB.name}
                  w="400px"
                  h="300px"
                  objectFit="cover"
                  loading="lazy"
                />
              </Box>
            </Form>

            <VStack spaceY="2">
              <Text fontWeight="semibold">{imageB.name}</Text>
              <Text fontSize="sm" color="gray.600">
                Elo: {Math.round(imageB.elo)}
              </Text>

              <Form method="post">
                <input type="hidden" name="winnerId" value={imageB.id} />
                <input type="hidden" name="loserId" value={imageA.id} />
                <Button
                  type="submit"
                  colorScheme="blue"
                  size="lg"
                >
                  Choose This One
                </Button>
              </Form>
            </VStack>
          </VStack>
        </HStack>

        <Button variant="outline" onClick={() => window.location.reload()}>
          Skip This Comparison
        </Button>
      </VStack>
    </Box>
  )
} 