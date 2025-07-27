import { useState, useEffect, useRef } from "react"
import { Box, Button, Heading, Image, VStack, HStack, Text, Spinner, Center, IconButton } from "@chakra-ui/react"
import { Form, useNavigation, Link } from "react-router"
import type { Route } from "./+types/compare"
import { useColorModeValue } from "~/components/ui/color-mode"
import { FaArrowLeft } from "react-icons/fa"

// Import server functions
export { loader, action } from "./compare.server"

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
              {/* <Text fontSize="sm" color={subTextColor}>
                Elo: {Math.round(imageA.elo)}
              </Text> */}

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
              {/* <Text fontSize="sm" color={subTextColor}>
                Elo: {Math.round(imageB.elo)}
              </Text> */}

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