import { z } from 'zod';

// --- Shared shape -----------------------------------------------------------
// Gemini returns structured JSON matching `breakdownResponseSchema` (an OpenAPI
// subset it enforces natively); we still validate with zod because the model
// can occasionally drift, and zod is our source of truth for types downstream.

export const subtaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(''),
  weight: z.number().min(1).max(10),
});

export const breakdownSchema = z.object({
  subtasks: z.array(subtaskSchema).min(1).max(12),
});

export type Subtask = z.infer<typeof subtaskSchema>;
export type Breakdown = z.infer<typeof breakdownSchema>;

// Gemini `responseSchema` (OpenAPI-subset). Mirrors `breakdownSchema`.
export const breakdownResponseSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    subtasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          weight: { type: 'number' },
        },
        required: ['title', 'description', 'weight'],
      },
    },
  },
  required: ['subtasks'],
};

// --- Prompt builders --------------------------------------------------------

export function initialBreakdownPrompt(
  title: string,
  description: string,
): string {
  return `You are a task breakdown assistant. Given a project title and description, break it into 3-7 high-level subtasks. Each should be a meaningful, distinct chunk of work. Assign a weight (1-10) representing relative effort.

Return JSON only, matching: { "subtasks": [{ "title", "description", "weight" }] }

Example
Project title: Launch a personal blog
Project description: A simple blog where I can publish articles, built with a static site generator and hosted for free.
{"subtasks":[{"title":"Choose and set up a static site generator","description":"Evaluate options (Hugo, Astro, Eleventy), pick one, and scaffold the project locally.","weight":3},{"title":"Design the layout and theme","description":"Create or adapt a theme: home page, article page, and an about page.","weight":5},{"title":"Write and format the first three articles","description":"Draft initial content in Markdown and verify rendering.","weight":4},{"title":"Set up hosting and a custom domain","description":"Deploy to a free host and point a domain at it with HTTPS.","weight":3},{"title":"Add an RSS feed and basic analytics","description":"Generate a feed and wire up a privacy-friendly analytics snippet.","weight":2}]}

Now break down this project.
Project title: ${title}
Project description: ${description}`;
}

export function expandNodePrompt(
  projectTitle: string,
  breadcrumb: string,
  nodeTitle: string,
  nodeDescription: string,
): string {
  return `You are a task breakdown assistant. Given a task within a larger project, break it into 2-6 smaller, more concrete subtasks. Make them comically small — each should be a single concrete action that takes less than an hour. Assign weights (1-10).

Return JSON only, matching: { "subtasks": [{ "title", "description", "weight" }] }

Example
Project context: Launch a personal blog
Parent task path: Launch a personal blog > Set up hosting and a custom domain
Task to break down: Set up hosting and a custom domain
Task description: Deploy to a free host and point a domain at it with HTTPS.
{"subtasks":[{"title":"Create an account on the hosting provider","description":"Sign up and connect the site's git repository.","weight":1},{"title":"Configure the build command and output directory","description":"Set the framework preset so deploys succeed.","weight":2},{"title":"Trigger the first deploy and verify the live URL","description":"Push to main and open the generated URL.","weight":1},{"title":"Buy or select a domain and add it","description":"Register the domain and add it in the host's domain settings.","weight":2},{"title":"Update DNS records and confirm HTTPS","description":"Point the domain's records at the host and wait for the certificate.","weight":2}]}

Now break down this task.
Project context: ${projectTitle}
Parent task path: ${breadcrumb}
Task to break down: ${nodeTitle}
Task description: ${nodeDescription}`;
}
