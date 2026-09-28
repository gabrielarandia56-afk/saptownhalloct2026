/**
 * SFW and Profanity Filter for Prompt Drop
 * Corporate safe-guards to ensure high-fives and no HR escalations!
 */

const PROFANITY_LIST = [
  "fuck", "shit", "bitch", "asshole", "dick", "pussy", "cunt", "cock",
  "bastard", "slut", "whore", "nigger", "faggot", "retard", "porn",
  "sex", "nude", "naked", "penis", "vagina", "tits", "boobs", "bollocks",
  "wanker", "motherfucker", "twat", "dumbass", "jackass"
];

// Regex matching common leetspeak substitutions
function normalizeText(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[@4]/g, "a")
    .replace(/[3]/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/[0]/g, "o")
    .replace(/[$5]/g, "s")
    .replace(/[7+]/g, "t")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Checks if a string contains inappropriate words
 */
function isProfane(text) {
  if (!text || typeof text !== "string") return false;
  
  const rawWords = text.toLowerCase().split(/\s+/);
  for (const word of rawWords) {
    const cleanWord = word.replace(/[^a-z0-9]/g, "");
    if (PROFANITY_LIST.includes(cleanWord)) {
      return true;
    }
  }

  const normalized = normalizeText(text);
  for (const badWord of PROFANITY_LIST) {
    if (normalized.includes(badWord)) {
      return true;
    }
  }

  return false;
}

/**
 * Clean or mask profane words
 */
function cleanText(text) {
  if (!text) return "";
  let cleaned = text;
  for (const badWord of PROFANITY_LIST) {
    const regex = new RegExp(`\\b${badWord}\\b`, "gi");
    cleaned = cleaned.replace(regex, "****");
  }
  return cleaned;
}

module.exports = {
  isProfane,
  cleanText
};
