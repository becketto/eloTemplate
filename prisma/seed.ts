import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

const prisma = new PrismaClient()

async function main() {
  // Clear existing data
  await prisma.image.deleteMany()

  // Scan the twitterMoots folder
  const sourceDir = 'placeholder'

  if (fs.existsSync(sourceDir)) {
    const files = fs.readdirSync(sourceDir)
    const imageFiles = files.filter(file =>
      /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(file)
    )

    if (imageFiles.length === 0) {
      console.log('No image files found in the twitterMoots folder')
      return
    }

    // Copy images to the optimized directory and create database entries
    const optimizedDir = 'placeholder'

    // Create optimized directory if it doesn't exist
    if (!fs.existsSync(optimizedDir)) {
      fs.mkdirSync(optimizedDir, { recursive: true })
    }

    const imageData = []

    for (const file of imageFiles) {
      const sourcePath = path.join(sourceDir, file)
      const ext = path.extname(file).toLowerCase()
      const nameWithoutExt = file.replace(/\.[^/.]+$/, "")
      const optimizedFileName = `${nameWithoutExt}.webp`
      const destPath = path.join(optimizedDir, optimizedFileName)

      try {
        // Optimize and convert image to WebP for better compression
        await sharp(sourcePath)
          .resize(800, 600, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .webp({
            quality: 85,
            effort: 4
          })
          .toFile(destPath)

        console.log(`Optimized: ${file} -> ${optimizedFileName}`)

        // Create database entry (you may need to adjust the URL path)
        imageData.push({
          name: nameWithoutExt,
          url: `/optimized/${optimizedFileName}`,
          elo: 1200.0
        })
      } catch (error) {
        console.error(`Failed to optimize ${file}:`, error)
        // Fallback: copy original file
        fs.copyFileSync(sourcePath, path.join(optimizedDir, file))
        imageData.push({
          name: nameWithoutExt,
          url: `/optimized/${file}`,
          elo: 1200.0
        })
      }
    }

    await prisma.image.createMany({ data: imageData })
    console.log(`Imported ${imageData.length} images from twitterMoots folder!`)
    console.log('Images copied to placeholder/ and added to database')
  } else {
    console.error('twitterMoots folder not found at:', sourceDir)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })