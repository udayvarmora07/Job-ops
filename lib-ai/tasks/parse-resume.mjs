/**
 * lib-ai/tasks/parse-resume.mjs — parse a raw resume/CV text into structured
 * JSON that pre-fills the onboarding wizard (UserProfile fields).
 *
 * Input is the extracted text from an uploaded PDF/DOCX, or pasted plain text.
 * Output is structured JSON the frontend maps onto UserProfile fields.
 *
 * Output (parsed by parseResumeJson):
 *   { fullName, email, phone, city, country, linkedinUrl, githubUrl,
 *     portfolioUrl, targetRoles[], superpowers[], pastCompanies[], schools[],
 *     currentRole, currentCompany, headline, summary, cvMarkdown }
 */

import { CLI_RULES } from '../context.mjs';

/**
 * @param {string} resumeText  raw text extracted from the uploaded resume
 */
export function buildParseResume(resumeText) {
  const text = String(resumeText || '').trim();
  if (!text) throw new Error('buildParseResume: empty resume text.');

  const system = `You parse a raw resume/CV text into STRICT JSON that pre-fills a user's career profile.

OUTPUT RULES (enforced by code):
1. Return ONLY valid JSON. No markdown, no code fences, no prose before or after.
2. Exactly these keys (use "" or [] when unknown — NEVER invent a value):
   {
     "fullName": string,          // the person's full name
     "email": string,             // primary email if present
     "phone": string,             // phone if present
     "city": string,              // current city if inferable
     "country": string,           // current country if inferable
     "linkedinUrl": string,       // LinkedIn URL if present
     "githubUrl": string,         // GitHub URL if present
     "portfolioUrl": string,      // personal site / portfolio if present
     "currentRole": string,       // current or most recent job title
     "currentCompany": string,    // current or most recent employer
     "headline": string,          // one-line professional headline
     "targetRoles": string[],     // roles this person is targeting (infer from skills/title)
     "superpowers": string[],     // key technical skills / tools / platforms
     "pastCompanies": string[],   // notable past employers (for referral matching)
     "schools": string[],         // educational institutions attended
     "summary": string,           // 2-3 sentence professional summary
     "cvMarkdown": string         // a clean markdown version of the full resume
   }
3. Do NOT fabricate any value. If something isn't in the resume, use "" or [].
4. Extract names, emails, URLs, phone numbers EXACTLY as written — do not reformat.
5. targetRoles: infer from the person's title, skills, and stated objectives. If unclear,
   use their current role title and common adjacent titles.
6. superpowers: extract concrete technical skills (tools, platforms, languages, methodologies).
   Keep them as short tokens (e.g. "Kubernetes", "Terraform", "Python", "CI/CD").
7. cvMarkdown: produce a clean, well-structured markdown version of the resume — sections
   for Summary, Experience, Skills, Education. Preserve all facts, metrics, and dates.
   Do NOT add anything not in the original.

${CLI_RULES}`;

  const prompt = `RESUME TEXT TO PARSE:

${text}

Return ONLY the JSON object.`;

  return { system, prompt };
}

/** Parse the model's JSON output tolerantly (strips code fences / stray prose). */
export function parseResumeJson(text) {
  const raw = String(text || '')
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch {
    const s = raw.indexOf('{');
    const e = raw.lastIndexOf('}');
    if (s >= 0 && e > s) {
      try {
        obj = JSON.parse(raw.slice(s, e + 1));
      } catch {
        obj = null;
      }
    }
  }
  if (!obj || typeof obj !== 'object') return null;

  const arr = (v) => (Array.isArray(v) ? v.filter(Boolean).map(String) : []);
  const str = (v) => (v == null ? '' : String(v).trim());

  return {
    fullName: str(obj.fullName),
    email: str(obj.email),
    phone: str(obj.phone),
    city: str(obj.city),
    country: str(obj.country),
    linkedinUrl: str(obj.linkedinUrl),
    githubUrl: str(obj.githubUrl),
    portfolioUrl: str(obj.portfolioUrl),
    currentRole: str(obj.currentRole),
    currentCompany: str(obj.currentCompany),
    headline: str(obj.headline),
    targetRoles: arr(obj.targetRoles),
    superpowers: arr(obj.superpowers),
    pastCompanies: arr(obj.pastCompanies),
    schools: arr(obj.schools),
    summary: str(obj.summary),
    cvMarkdown: str(obj.cvMarkdown),
  };
}
