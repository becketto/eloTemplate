/*
# Run the light seed
npx tsx prisma/seedLight.ts
*/

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

async function main() {
    // Clear existing data
    await prisma.image.deleteMany()

    // Scan the optimized folder
    const optimizedDir = 'placeholder'

    if (!fs.existsSync(optimizedDir)) {
        console.error('Optimized folder not found at:', optimizedDir)
        return
    }

    const files = fs.readdirSync(optimizedDir)
    const imageFiles = files.filter(file =>
        /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(file)
    )

    if (imageFiles.length === 0) {
        console.log('No image files found in the optimized folder')
        return
    }

    console.log(`Found ${imageFiles.length} images in optimized folder`)

    const imageData = []

    for (const file of imageFiles) {
        const nameWithoutExt = file.replace(/\.[^/.]+$/, "")

        // Create database entry
        imageData.push({
            name: nameWithoutExt,
            url: `/external-images/${file}`, // Changed to proper web URL format
            elo: 1200.0
        })
    }

    // Use upsert to handle potential duplicates gracefully
    console.log('Inserting images into database...')

    // Use createMany with skipDuplicates to avoid unique constraint errors
    const result = await prisma.image.createMany({
        data: imageData,
        skipDuplicates: true
    })

    console.log(`Successfully imported ${result.count} new images from optimized folder!`)
    console.log(`Total images processed: ${imageFiles.length}`)

    if (result.count < imageFiles.length) {
        console.log(`Skipped ${imageFiles.length - result.count} duplicate images`)
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