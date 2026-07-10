#!/usr/bin/env node
// Placeholder: the original v2 batch resume generator is not present in this
// checkout (the file had been overwritten by a stray git error message).
// Resume generation is available through the working entry points below.
//
// Usage:
//   • Single ATS PDF:   node generate-pdf.mjs <content.json> <out.pdf>
//   • LaTeX / Overleaf: node generate-latex.mjs
//   • Web dashboard:    Resumes tab (POST /api/generate-cv-pdf)

console.error(
  "generate-resumes-v2.mjs is a placeholder in this checkout.\n" +
    "Use `node generate-pdf.mjs`, `node generate-latex.mjs`, or the web dashboard's Resumes tab instead."
);
process.exit(1);
