import { Box, Button, Heading, VStack, HStack, Text, Image } from "@chakra-ui/react"
import { Link } from "react-router"
import type { Route } from "./+types/home"
import { db } from "~/db.server"

export async function loader({ request }: Route.LoaderArgs) {
  // Add cache headers for better performance
  const headers = new Headers()
  headers.set("Cache-Control", "public, max-age=60, s-maxage=300") // Cache for 1 min client, 5 min CDN

  // Get total count first
  const totalImages = await db.image.count()

  // Get top 50 and bottom 50 images by Elo rating for leaderboard with optimized query
  const [topImages, bottomImages] = await Promise.all([
    db.image.findMany({
      select: {
        name: true,
        url: true,
        elo: true
      },
      orderBy: { elo: 'desc' },
      take: 50
    }),
    db.image.findMany({
      select: {
        name: true,
        url: true,
        elo: true
      },
      orderBy: { elo: 'asc' },
      take: 50
    })
  ])

  // Reverse the bottom images so worst (lowest Elo) appears first
  const reversedBottomImages = bottomImages.reverse()

  return Response.json({
    topImages,
    bottomImages: reversedBottomImages,
    totalImages,
    timestamp: Date.now() // For cache busting if needed
  }, { headers })
}

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Elo Image Comparison" },
    { name: "description", content: "Compare and rate images using the Elo rating system" },
  ]
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { topImages, bottomImages, totalImages } = loaderData

  return (
    <Box p={{ base: "4", md: "10" }} maxW="6xl" mx="auto" minH="100vh" bg="">
      <VStack spaceY="8">
        <Heading fontWeight="light" textAlign="center" size={{ base: "xl", md: "2xl" }} color="white">
          Image Elo Rating System
        </Heading>

        <Text textAlign="center" fontSize={{ base: "md", md: "lg" }} color="gray.300">
          Compare images and see which ones rise to the top using the Elo rating system!
        </Text>

        <Text textAlign="center" fontSize="md" color="gray.400">
          {totalImages} images ready for comparison
        </Text>

        <Link to="/compare">
          <Button variant="outline" size="lg" color="white" borderColor="gray.600" borderWidth="2px" _hover={{ bg: "gray.700" }}>
            Start Comparing Images
          </Button>
        </Link>

        <VStack w="full" spacing={{ base: "8", lg: "0" }}>
          <HStack
            w="full"
            align="flex-start"
            gap="8"
            flexDirection={{ base: "column", lg: "row" }}
            spacing={{ base: "8", lg: "8" }}
          >
            {/* Top 50 Section */}
            <Box flex="1" w="full" maxW={{ base: "full", lg: "none" }}>
              <Heading size="lg" mb="6" textAlign="center" color="green.400">
                🏆 Top 50 Images
              </Heading>

              <VStack spaceY="3" maxH="600px" overflowY="auto" pr="2">
                {topImages.map((image: { name: string; url: string; elo: number }, index: number) => (
                  <HStack
                    key={`top-${index}`}
                    w="full"
                    p={{ base: "3", md: "4" }}
                    borderWidth="1px"
                    borderColor="gray.600"
                    borderRadius="lg"
                    justifyContent="space-between"
                    align="center"
                    bg="gray.800"
                    _hover={{ bg: "gray.700", boxShadow: "md" }}
                    transition="all 0.3s ease"
                    boxShadow="sm"
                  >
                    <Text fontWeight="bold" fontSize={{ base: "lg", md: "2xl" }} minW={{ base: "12", md: "16" }} color="green.400" textAlign="left">
                      #{index + 1}
                    </Text>
                    <Image
                      src={image.url}
                      alt={`Image ${index + 1}`}
                      w={{ base: "100px", md: "150px" }}
                      h={{ base: "100px", md: "150px" }}
                      objectFit="cover"
                      borderRadius="lg"
                      loading="lazy"
                      transition="transform 0.3s ease"
                      _hover={{ transform: "scale(1.05)" }}
                    />
                    <Text fontWeight="bold" color="green.400" fontSize={{ base: "md", md: "xl" }} minW={{ base: "20", md: "28" }} textAlign="right">
                      {Math.round(image.elo)} Elo
                    </Text>
                  </HStack>
                ))}
              </VStack>
            </Box>

            {/* Bottom 50 Section */}
            <Box flex="1" w="full" maxW={{ base: "full", lg: "none" }}>
              <Heading size="lg" mb="6" textAlign="center" color="red.400">
                📉 Bottom 50 Images
              </Heading>

              <VStack spaceY="3" maxH="600px" overflowY="auto" pr="2">
                {bottomImages.map((image: { name: string; url: string; elo: number }, index: number) => (
                  <HStack
                    key={`bottom-${index}`}
                    w="full"
                    p={{ base: "3", md: "4" }}
                    borderWidth="1px"
                    borderColor="gray.600"
                    borderRadius="lg"
                    justifyContent="space-between"
                    align="center"
                    bg="gray.800"
                    _hover={{ bg: "gray.700", boxShadow: "md" }}
                    transition="all 0.3s ease"
                    boxShadow="sm"
                  >
                    <Text fontWeight="bold" fontSize={{ base: "lg", md: "2xl" }} minW={{ base: "12", md: "16" }} color="red.400" textAlign="left">
                      #{totalImages - index}
                    </Text>
                    <Image
                      src={image.url}
                      alt={`Image ${totalImages - index}`}
                      w={{ base: "100px", md: "150px" }}
                      h={{ base: "100px", md: "150px" }}
                      objectFit="cover"
                      borderRadius="lg"
                      loading="lazy"
                      transition="transform 0.3s ease"
                      _hover={{ transform: "scale(1.05)" }}
                    />
                    <Text fontWeight="bold" color="red.400" fontSize={{ base: "md", md: "xl" }} minW={{ base: "20", md: "28" }} textAlign="right">
                      {Math.round(image.elo)} Elo
                    </Text>
                  </HStack>
                ))}
              </VStack>
            </Box>
          </HStack>
        </VStack>
      </VStack>
    </Box>
  )
}
