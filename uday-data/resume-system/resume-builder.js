// Universal resume layout engine for Uday Varmora.
// The FORMAT is fixed here (matches the uploaded resumes); only the CONTENT
// passed in changes per job description. See README.md for the workflow.

const {
  Document, Paragraph, TextRun, AlignmentType,
  LevelFormat, BorderStyle, TabStopType, ExternalHyperlink
} = require('docx');

// ===== FIXED IDENTITY (never changes per JD) =====
const IDENTITY = {
  name: "UDAY VARMORA",
  phone: "+91 96623 85170",
  email: "varmorauday1045@gmail.com",
  linkedin: "linkedin.com/in/udayvarmora",
  github: "github.com/udayvarmora07",
  location: "Ahmedabad, India",
};

// ===== STYLE CONSTANTS =====
const FONT = "Calibri";
const BLACK = "000000";
const DARK_GRAY = "333333";

// Accent colour schemes (navy default; teal optional for startups)
const SCHEMES = { navy: "1B3A6B", teal: "0F766E" };

// Sizes (half-points)
const SZ_NAME = 32;          // 16pt
const SZ_HEADER = 22;        // 11pt
const SZ_BODY = 20;          // 10pt
const SZ_CONTACT = 20;       // 10pt
const SZ_SKILLS = 20;        // 10pt
const SZ_PROJECT_TECH = 19;  // 9.5pt

// Spacing presets (twips). Used as the SHRINK fallback when content is long
// enough to risk a second page. For normal/short content, build.js instead
// scales spacing UP via makeSpacing() so the resume fills the page top-to-bottom
// between the fixed 25pt margins (no large empty gap at the bottom).
const SPACING = {
  normal: { LINE: 211, SECTION_BEFORE: 72, SECTION_AFTER: 16, BULLET_BEFORE: 8, SUB_HEADER_BEFORE: 20, JOB_BEFORE: 80, CONTACT_AFTER: 140 },
  dense:  { LINE: 205, SECTION_BEFORE: 54, SECTION_AFTER: 12, BULLET_BEFORE: 5, SUB_HEADER_BEFORE: 14, JOB_BEFORE: 60, CONTACT_AFTER: 110 },
  denser: { LINE: 200, SECTION_BEFORE: 36, SECTION_AFTER:  9, BULLET_BEFORE: 3, SUB_HEADER_BEFORE: 10, JOB_BEFORE: 44, CONTACT_AFTER:  90 },
};
const SPACING_ORDER = ["normal", "dense", "denser"];

// Continuous spacing model for the vertical-FILL pass. factor === 1 reproduces
// the "normal" preset; factor > 1 opens up leading and gaps proportionally so
// the content spreads to fill the page. Leading grows more slowly than the gaps
// (dampened) so body text stays tidy rather than looking double-spaced.
const SPACING_BASE = { LINE: 211, SECTION_BEFORE: 72, SECTION_AFTER: 16, BULLET_BEFORE: 8, SUB_HEADER_BEFORE: 20, JOB_BEFORE: 80, CONTACT_AFTER: 140 };
function makeSpacing(factor = 1) {
  const f = Math.max(0.7, factor);
  const lineF = 1 + (f - 1) * 0.6; // dampen leading growth
  return {
    LINE: Math.round(SPACING_BASE.LINE * lineF),
    SECTION_BEFORE: Math.round(SPACING_BASE.SECTION_BEFORE * f),
    SECTION_AFTER: Math.round(SPACING_BASE.SECTION_AFTER * f),
    BULLET_BEFORE: Math.round(SPACING_BASE.BULLET_BEFORE * f),
    SUB_HEADER_BEFORE: Math.round(SPACING_BASE.SUB_HEADER_BEFORE * f),
    JOB_BEFORE: Math.round(SPACING_BASE.JOB_BEFORE * f),
    CONTACT_AFTER: Math.round(SPACING_BASE.CONTACT_AFTER * f),
  };
}

// ===== INLINE MARKUP =====
// Turns "plain **bold** plain" into an array of TextRuns. Lets content files
// stay readable (same **bold** convention as cv.md).
function runsFromMarkup(text, opts = {}) {
  return String(text)
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(s => s.length)
    .map(seg => {
      const bold = seg.startsWith("**") && seg.endsWith("**");
      return r(bold ? seg.slice(2, -2) : seg, { ...opts, bold });
    });
}

function r(text, opts = {}) {
  return new TextRun({
    text, font: FONT,
    size: opts.size || SZ_BODY,
    bold: opts.bold || false,
    italics: opts.italics || false,
    color: opts.color || BLACK,
  });
}
const b = (text, opts = {}) => r(text, { ...opts, bold: true });

function link(url, displayText) {
  return new ExternalHyperlink({
    link: url,
    children: [new TextRun({ text: displayText, font: FONT, size: SZ_CONTACT, color: DARK_GRAY })],
  });
}

// ===== BUILD =====
function buildResumeDoc(content, spacingArg = "normal") {
  // spacingArg may be: a preset name ("normal"/"dense"/"denser"), a numeric
  // fill factor (>1 = fill the page), or a fully-formed spacing object.
  let S;
  if (spacingArg && typeof spacingArg === "object") S = spacingArg;
  else if (typeof spacingArg === "number") S = makeSpacing(spacingArg);
  else S = SPACING[spacingArg] || SPACING.normal;
  const ACCENT = SCHEMES[content.colorScheme] || SCHEMES.navy;

  const sectionHeader = (text) => new Paragraph({
    spacing: { before: S.SECTION_BEFORE, after: S.SECTION_AFTER, line: S.LINE, lineRule: "exact" },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 1 } },
    children: [new TextRun({ text: text.toUpperCase(), font: FONT, size: SZ_HEADER, bold: true, color: ACCENT })],
  });

  const bullet = (runs, opts = {}) => new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: opts.before !== undefined ? opts.before : S.BULLET_BEFORE, after: 0, line: S.LINE, lineRule: "exact" },
    children: Array.isArray(runs) ? runs : [r(runs)],
  });

  const p = (runs, opts = {}) => new Paragraph({
    spacing: { before: opts.before || 0, after: opts.after || 0, line: S.LINE, lineRule: "exact" },
    alignment: opts.alignment,
    children: Array.isArray(runs) ? runs : [r(runs)],
  });

  const skillRow = (category, items) => p(
    [b(category + ": ", { size: SZ_SKILLS }), ...runsFromMarkup(items, { size: SZ_SKILLS })],
    { before: 0 }
  );

  const headerRow = (left, right, opts = {}) => new Paragraph({
    spacing: { before: opts.before !== undefined ? opts.before : 80, after: 0, line: S.LINE, lineRule: "exact" },
    tabStops: [{ type: TabStopType.RIGHT, position: 11088 }],
    children: [...left, r("\t"), ...right],
  });

  const children = [];

  // Header — name + contact (fixed identity)
  children.push(new Paragraph({
    spacing: { before: 0, after: 0, line: S.LINE, lineRule: "exact" },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: IDENTITY.name, font: FONT, size: SZ_NAME, bold: true, color: ACCENT })],
  }));
  children.push(new Paragraph({
    spacing: { before: 0, after: S.CONTACT_AFTER ?? 140, line: S.LINE, lineRule: "exact" },
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({ text: `${IDENTITY.phone} | `, font: FONT, size: SZ_CONTACT, color: DARK_GRAY }),
      link("mailto:" + IDENTITY.email, IDENTITY.email),
      new TextRun({ text: " | ", font: FONT, size: SZ_CONTACT, color: DARK_GRAY }),
      link("https://" + IDENTITY.linkedin, IDENTITY.linkedin),
      new TextRun({ text: " | ", font: FONT, size: SZ_CONTACT, color: DARK_GRAY }),
      link("https://" + IDENTITY.github, IDENTITY.github),
      new TextRun({ text: ` | ${IDENTITY.location}`, font: FONT, size: SZ_CONTACT, color: DARK_GRAY }),
    ],
  }));

  // Professional Summary
  children.push(sectionHeader("Professional Summary"));
  children.push(p(runsFromMarkup(content.summary)));

  // Technical Skills
  children.push(sectionHeader("Technical Skills"));
  for (const [cat, items] of content.skills) children.push(skillRow(cat, items));

  // Professional Experience
  children.push(sectionHeader("Professional Experience"));
  content.experience.forEach((job, i) => {
    children.push(headerRow(
      [b(job.role), r("  |  " + job.org, { color: DARK_GRAY })],
      [b(job.dates)],
      { before: i === 0 ? 0 : (S.JOB_BEFORE ?? 80) }
    ));
    for (const line of job.bullets) children.push(bullet(runsFromMarkup(line)));
  });

  // Key Projects
  children.push(sectionHeader("Key Projects"));
  for (const proj of content.projects) {
    children.push(p([b(proj.title)], { before: S.SUB_HEADER_BEFORE }));
    children.push(p([r(proj.tech, { italics: true, size: SZ_PROJECT_TECH, color: DARK_GRAY })], { before: 0 }));
    for (const line of proj.bullets) children.push(bullet(runsFromMarkup(line)));
  }

  // Education
  children.push(sectionHeader("Education"));
  children.push(headerRow(runsFromMarkup(content.education.left), [b(content.education.right)], { before: 0 }));

  // Achievements
  if (content.achievements && content.achievements.length) {
    children.push(sectionHeader("Achievements"));
    content.achievements.forEach((line, i) =>
      children.push(bullet(runsFromMarkup(line), { before: i === 0 ? 0 : S.BULLET_BEFORE })));
  }

  return new Document({
    creator: "Uday Varmora",
    title: content.title || "Uday Varmora - Resume",
    styles: { default: { document: { run: { font: FONT, size: SZ_BODY, color: BLACK } } } },
    numbering: {
      config: [{
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 252, hanging: 252 } } },
        }],
      }],
    },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 500, right: 576, bottom: 500, left: 576 } } },
      children,
    }],
  });
}

module.exports = { buildResumeDoc, IDENTITY, SPACING_ORDER, makeSpacing };
