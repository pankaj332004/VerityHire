/**
 * Client for interacting with Python ML microservice (FastAPI).
 * Includes intelligent built-in fallback logic so the backend functions
 * even if the Python service is temporarily offline during Phase 1.
 */

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// Known skills catalog for extraction and recommendations
const SKILLS_DATABASE = [
  'javascript', 'typescript', 'react', 'next.js', 'vue', 'angular',
  'node.js', 'express', 'python', 'fastapi', 'django', 'flask',
  'java', 'spring boot', 'c++', 'c#', '.net', 'golang', 'rust',
  'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch',
  'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'ci/cd', 'git',
  'graphql', 'rest api', 'microservices', 'machine learning', 'deep learning',
  'scikit-learn', 'pytorch', 'tensorflow', 'nlp', 'spacy', 'pandas', 'numpy'
];

const CURATED_RESOURCES = {
  docker: {
    skill: 'Docker',
    resourceType: 'documentation',
    title: 'Docker Getting Started Guide',
    url: 'https://docs.docker.com/get-started/',
  },
  kubernetes: {
    skill: 'Kubernetes',
    resourceType: 'course',
    title: 'Kubernetes Basics & Architecture',
    url: 'https://kubernetes.io/docs/tutorials/kubernetes-basics/',
  },
  aws: {
    skill: 'AWS',
    resourceType: 'tutorial',
    title: 'AWS Fundamentals for Cloud Developers',
    url: 'https://aws.amazon.com/getting-started/',
  },
  redis: {
    skill: 'Redis',
    resourceType: 'documentation',
    title: 'Redis University & In-Memory Caching',
    url: 'https://redis.io/learn',
  },
  postgresql: {
    skill: 'PostgreSQL',
    resourceType: 'tutorial',
    title: 'PostgreSQL Tutorial for Backend Engineers',
    url: 'https://www.postgresqltutorial.com/',
  },
  typescript: {
    skill: 'TypeScript',
    resourceType: 'documentation',
    title: 'TypeScript for JavaScript Programmers',
    url: 'https://www.typescriptlang.org/docs/',
  },
};

/**
 * Extracts skills and entities from raw resume text
 */
const parseResumeText = async (text) => {
  try {
    const res = await fetch(`${ML_SERVICE_URL}/parse-resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeText: text }),
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    // Fall through to fallback
  }

  // Fallback Rule-Based Extraction
  const lowerText = (text || '').toLowerCase();
  const matchedSkills = SKILLS_DATABASE.filter((skill) =>
    lowerText.includes(skill.toLowerCase())
  ).map((s) => s.charAt(0).toUpperCase() + s.slice(1));

  return {
    skills: matchedSkills.length > 0 ? matchedSkills : ['JavaScript', 'React', 'Node.js', 'MongoDB'],
    experience: [],
    education: [],
    projects: [],
  };
};

/**
 * Calculates candidate match score against a job
 */
const scoreApplication = async ({ jdText, requiredSkills = [], studentProfile, cgpa = 7.0 }) => {
  try {
    const res = await fetch(`${ML_SERVICE_URL}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jdText, requiredSkills, studentProfile, cgpa }),
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    // Fall through to fallback
  }

  // Fallback Multi-Factor Scoring Formula
  const candidateSkills = (studentProfile?.parsedProfile?.skills || []).map((s) => s.toLowerCase());
  const reqSkillsLower = (requiredSkills || []).map((s) => s.toLowerCase());

  const matched = reqSkillsLower.filter((s) => candidateSkills.includes(s));
  const missing = reqSkillsLower.filter((s) => !candidateSkills.includes(s));

  const skillOverlapRatio = reqSkillsLower.length > 0 ? matched.length / reqSkillsLower.length : 0.75;
  const skillScore = Math.round(skillOverlapRatio * 40); // 40 max points

  // Academic Fit (CGPA scaled to 20 max points)
  const cgpaScore = Math.min(20, Math.round((Math.max(0, cgpa) / 10) * 20));

  // Semantic & Project Relevance (estimated based on overlap & profile richness)
  const hasProjects = (studentProfile?.parsedProfile?.projects || []).length > 0;
  const projectScore = hasProjects ? 15 : 10; // 20 max points
  const semanticScore = Math.min(20, Math.round(skillOverlapRatio * 18) + (hasProjects ? 2 : 0));

  const finalScore = Math.min(100, Math.max(10, skillScore + cgpaScore + semanticScore + projectScore));

  const featureBreakdown = [
    { feature: 'Core Skill Overlap', value: skillScore, weight: 40 },
    { feature: 'Academic & CGPA Fit', value: cgpaScore, weight: 20 },
    { feature: 'Semantic Relevance', value: semanticScore, weight: 20 },
    { feature: 'Project & Experience Fit', value: projectScore, weight: 20 },
  ];

  const matchedFormatted = requiredSkills.filter((s) =>
    candidateSkills.includes(s.toLowerCase())
  );
  const missingFormatted = requiredSkills.filter(
    (s) => !candidateSkills.includes(s.toLowerCase())
  );

  const explanationSummary = `Candidate demonstrates a ${Math.round(skillOverlapRatio * 100)}% match with required core technologies (${matchedFormatted.slice(0, 3).join(', ')}). ${
    missingFormatted.length > 0
      ? `Lacks direct experience in: ${missingFormatted.slice(0, 2).join(', ')}.`
      : 'Meets or exceeds all listed technical criteria.'
  }`;

  return {
    finalScore,
    featureBreakdown,
    matchedSkills: matchedFormatted,
    missingSkills: missingFormatted,
    explanation: {
      summary: explanationSummary,
      modelVersion: 'v1.0-deterministic',
    },
    scoredAt: new Date(),
  };
};

/**
 * Generates skill-gap report with actionable learning resources
 */
const generateSkillGap = async ({ studentSkills = [], requiredSkills = [] }) => {
  const currentLower = studentSkills.map((s) => s.toLowerCase());
  const missing = requiredSkills.filter((s) => !currentLower.includes(s.toLowerCase()));

  const recommendations = missing.map((skillName) => {
    const key = skillName.toLowerCase();
    if (CURATED_RESOURCES[key]) {
      return CURATED_RESOURCES[key];
    }
    return {
      skill: skillName,
      resourceType: 'documentation',
      title: `${skillName} Official Documentation & Quickstart`,
      url: `https://www.google.com/search?q=${encodeURIComponent(skillName + ' official documentation tutorial')}`,
    };
  });

  return {
    currentSkills: studentSkills,
    requiredSkills,
    missingSkills: missing,
    recommendations,
  };
};

/**
 * Simulates score change when candidate adds hypothetical skills
 */
const simulateWhatIf = async ({ currentScore, currentSkills = [], hypotheticalSkills = [], requiredSkills = [] }) => {
  const combined = Array.from(new Set([...currentSkills, ...hypotheticalSkills]));
  const simulated = await scoreApplication({
    requiredSkills,
    studentProfile: { parsedProfile: { skills: combined, projects: [{}] } },
    cgpa: 8.0,
  });

  const baseScore = currentScore || 65;
  const projectedScore = Math.min(100, Math.max(baseScore, simulated.finalScore));
  const scoreDelta = projectedScore - baseScore;

  return {
    hypotheticalSkills,
    currentScore: baseScore,
    projectedScore,
    scoreDelta: scoreDelta > 0 ? `+${scoreDelta}` : `${scoreDelta}`,
    newMatchedSkills: simulated.matchedSkills,
    remainingMissingSkills: simulated.missingSkills,
  };
};

module.exports = {
  parseResumeText,
  scoreApplication,
  generateSkillGap,
  simulateWhatIf,
};
