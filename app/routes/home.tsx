import { Box, Button, Heading, VStack, HStack, Text, Image } from "@chakra-ui/react"
import { Link } from "react-router"
import type { Route } from "./+types/home"
import { db } from "~/db.server"

export async function loader() {
  // Get top 5 images by Elo rating for leaderboard with optimized query
  const topImages = await db.image.findMany({
    select: {
      id: true,
      name: true,
      url: true,
      elo: true
    },
    orderBy: { elo: 'desc' },
    take: 5
  })

  const totalImages = await db.image.count()

  return {
    topImages,
    totalImages,
    timestamp: Date.now() // For cache busting if needed
  }
}

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Elo Image Comparison" },
    { name: "description", content: "Compare and rate images using the Elo rating system" },
  ]
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { topImages, totalImages } = loaderData

  return (
    <Box p="10" maxW="4xl" mx="auto">
      <VStack spaceY="8">
        <Heading fontWeight="light" textAlign="center" size="2xl">
          Image Elo Rating System
        </Heading>

        <Text textAlign="center" fontSize="lg" color="gray.600">
          Compare images and see which ones rise to the top using the Elo rating system!
        </Text>

        <Text textAlign="center" fontSize="md" color="gray.500">
          {totalImages} images ready for comparison
        </Text>

        <Link to="/compare">
          <Button colorScheme="blue" size="lg">
            Start Comparing Images
          </Button>
        </Link>

        <Box w="full">
          <Heading size="lg" mb="6" textAlign="center">
            Current Leaderboard
          </Heading>

          <VStack spaceY="4">
            {topImages.map((image: any, index: number) => (
              <HStack
                key={image.id}
                w="full"
                p="4"
                borderWidth="1px"
                borderRadius="lg"
                justifyContent="space-between"
              >
                <HStack>
                  <Text fontWeight="bold" fontSize="xl" minW="8">
                    #{index + 1}
                  </Text>
                  <Image
                    src={image.url}
                    alt={image.name}
                    w="60px"
                    h="45px"
                    objectFit="cover"
                    borderRadius="md"
                  />
                  <Text fontWeight="semibold">{image.name}</Text>
                </HStack>
                <Text fontWeight="bold" color="blue.500">
                  {Math.round(image.elo)} Elo
                </Text>
              </HStack>
            ))}
          </VStack>
        </Box>
      </VStack>
    </Box>
  )
}
