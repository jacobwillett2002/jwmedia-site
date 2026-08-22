import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    tag: z.string(),
    category: z.enum(['music', 'narrative', 'live']),
    videoProvider: z.enum(['vimeo', 'youtube']).optional(),
    videoId: z.string().optional(),
    thumbnail: z.string().optional(),
    thumbnailPosition: z.string().optional(),
    thumbnailFit: z.enum(['cover', 'contain']).default('cover'),
    caseStudyHref: z.string().optional(),
    description: z.string(),
    verifiedDescription: z.boolean().default(false),
    featured: z.boolean().default(false),
    featuredOrder: z.number().default(0),
    comingSoon: z.boolean().default(false),
    order: z.number().default(0),
  }),
});

export const collections = { projects };
