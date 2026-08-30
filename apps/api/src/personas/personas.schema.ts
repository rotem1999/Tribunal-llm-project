import { z } from 'zod';
import { Side } from '@tribunal/shared-types';

/**
 * Schema for the owner-provided personalities file (SPEC §8). Validated at boot;
 * the app fails fast if it is missing or malformed.
 */

const advocateSchema = z.object({
  key: z.string().min(1),
  side: z.nativeEnum(Side),
  name: z.string().min(1),
  traits: z.array(z.string()).optional(),
  systemPrompt: z.string().min(1, 'advocate systemPrompt must be non-empty'),
});

const judgeSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  traits: z.array(z.string()).optional(),
  systemPrompt: z.string().min(1, 'judge systemPrompt must be non-empty'),
});

export const personasSchema = z
  .object({
    advocates: z.array(advocateSchema).length(4, 'exactly 4 advocates required'),
    judges: z.array(judgeSchema).length(3, 'exactly 3 judges required'),
  })
  .superRefine((data, ctx) => {
    const support = data.advocates.filter((a) => a.side === Side.support).length;
    const against = data.advocates.filter((a) => a.side === Side.against).length;
    if (support !== 2 || against !== 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `advocates must be 2 support + 2 against (got ${support} support, ${against} against)`,
      });
    }
    const keys = [...data.advocates, ...data.judges].map((p) => p.key);
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'persona keys must be unique across advocates and judges',
      });
    }
  });

export type Advocate = z.infer<typeof advocateSchema>;
export type Judge = z.infer<typeof judgeSchema>;
export type Personas = z.infer<typeof personasSchema>;
