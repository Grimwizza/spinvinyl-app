import { createClient } from '@sanity/client'
import imageUrlBuilder from '@sanity/image-url'

// This client connects your React App to your Sanity Brain
export const client = createClient({
  projectId: 'bjw9onfc', // <--- PASTE YOUR ID HERE
  dataset: 'production',
  useCdn: true, // true = fast (cached), false = fresh data (good for drafting)
  apiVersion: '2023-05-03', // use a current date
})

// This helper function makes it easy to display images from Sanity
const builder = imageUrlBuilder(client)

export const urlFor = (source) => {
  return builder.image(source)
}