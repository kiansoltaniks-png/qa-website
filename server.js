require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function ask(system, user, tokens = 1500) {
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: tokens,
    system,
    messages: [{ role: 'user', content: user }]
  });
  return msg.content[0].text;
}

// ── ASK ──
app.post('/api/ask', async (req, res) => {
  const { question, topic, length, format, difficulty, tone, language,
          examples, followup, funfact, tldr, mnemonic, mistakes, analogy, quiz } = req.body;
  if (!question?.trim()) return res.status(400).json({ error: 'Question is required.' });

  const extras = [];
  if (examples)  extras.push('Include at least one real-world example.');
  if (followup)  extras.push('End with 2-3 follow-up questions to explore further.');
  if (funfact)   extras.push('End with an interesting fun fact about this topic.');
  if (tldr)      extras.push('End with a TL;DR (1-2 sentence summary).');
  if (mnemonic)  extras.push('Include a mnemonic or memory trick.');
  if (mistakes)  extras.push('Point out 1-2 common mistakes people make on this topic.');
  if (analogy)   extras.push('Include a helpful analogy to explain the concept.');
  if (quiz)      extras.push('End with a quick 2-question quiz to test understanding.');

  const system = `You are a helpful tutor specializing in ${topic||'general topics'}.
Answer in ${language||'English'}.
Format: ${format||'paragraph'}.
Length: ${length||'a paragraph'}.
Level: appropriate for ${difficulty||'a middle school student'}.
Tone: ${tone||'friendly'}.
${extras.join('\n')}`.trim();

  try {
    const answer = await ask(system, question.trim());
    res.json({ answer });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── QUIZ ──
app.post('/api/generate', async (req, res) => {
  const { topic, subtopic, qtype, qcount, difficulty, answerkey, hints, explain, varied, realworld } = req.body;
  const focus = subtopic ? ` focused on: ${subtopic}` : '';
  const extras = [];
  if (answerkey) extras.push('After all questions, add a clearly labeled ANSWER KEY section.');
  if (hints)     extras.push('Include a short hint below each question.');
  if (explain)   extras.push('After the answer key, explain why each answer is correct.');
  if (varied)    extras.push('Vary difficulty slightly (some easier, some harder).');
  if (realworld) extras.push('Use real-world scenarios and contexts in the questions.');

  const system = `You are an expert teacher creating a practice quiz.
Generate exactly ${qcount||10} ${qtype||'multiple choice'} questions about ${topic}${focus}.
Difficulty: ${difficulty||'middle school'} level.
Number each question clearly.
${extras.join('\n')}`.trim();

  try {
    const questions = await ask(system, `Generate ${qcount} ${qtype} questions about ${topic}${focus}.`, 2000);
    res.json({ questions });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── FLASHCARDS ──
app.post('/api/flashcards', async (req, res) => {
  const { topic, subtopic, count, style, examples, mnemonic, difficulty } = req.body;
  const focus = subtopic ? ` about ${subtopic}` : '';

  const system = `You are creating flashcards for studying.
Generate exactly ${count||20} flashcards about ${topic}${focus}.
Format each card as: FRONT: [term/question] | BACK: [definition/answer]
Style: ${style||'term and definition'}.
${examples ? 'Include a brief example after the definition.' : ''}
${mnemonic ? 'Add a short memory tip after the definition.' : ''}
Put each flashcard on its own line. Use exactly this format: FRONT: ... | BACK: ...`.trim();

  try {
    const raw = await ask(system, `Create ${count} flashcards for ${topic}${focus}.`, 3000);
    const cards = raw.split('\n')
      .filter(l => l.includes('FRONT:') && l.includes('BACK:'))
      .map(l => {
        const [f, b] = l.split('|');
        return {
          front: (f||'').replace('FRONT:','').trim(),
          back:  (b||'').replace('BACK:','').trim()
        };
      }).filter(c => c.front && c.back);
    res.json({ cards, raw });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── STUDY GUIDE ──
app.post('/api/studyguide', async (req, res) => {
  const { topic, unit, type, difficulty, keyconcepts, definitions, examples,
          formulas, tips, practice, common, summary } = req.body;
  const focus = unit ? ` — ${unit}` : '';
  const include = [];
  if (keyconcepts) include.push('Key Concepts section');
  if (definitions)  include.push('Important Definitions');
  if (examples)     include.push('Examples for each concept');
  if (formulas)     include.push('Formulas and equations');
  if (tips)         include.push('Study tips and tricks');
  if (practice)     include.push('3-5 practice questions at the end');
  if (common)       include.push('Common mistakes to avoid');
  if (summary)      include.push('Summary paragraph at the very end');

  const system = `You are an expert teacher creating a ${type||'comprehensive study guide'}.
Subject: ${topic}${focus}
Level: ${difficulty||'middle school'}
Include the following sections: ${include.join(', ')}.
Use clear headers, organized sections, and make it easy to study from.`.trim();

  try {
    const guide = await ask(system, `Create a ${type} for ${topic}${focus}.`, 2500);
    res.json({ guide });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ESSAY ──
app.post('/api/essay', async (req, res) => {
  const { topic, existing, mode, type, level } = req.body;
  if (!topic?.trim()) return res.status(400).json({ error: 'Essay topic is required.' });

  const context = existing ? `\n\nThe student has written the following so far:\n"""\n${existing}\n"""` : '';
  const system = `You are an expert writing tutor helping a ${level||'high school'} student with a ${type||'argumentative'} essay.
Task: Provide ${mode||'a full outline'} for the essay.
Be specific, helpful, and provide actual content they can use.`.trim();

  try {
    const result = await ask(system, `Essay topic: "${topic}"${context}\n\nPlease provide ${mode}.`, 2000);
    res.json({ result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── VOCABULARY ──
app.post('/api/vocab', async (req, res) => {
  const { topic, focus, count, level, definition, example, pronunciation,
          synonyms, antonyms, mnemonic, partOfSpeech } = req.body;
  const theme = focus ? ` about ${focus}` : '';
  const include = [];
  if (definition)   include.push('definition');
  if (example)      include.push('example sentence');
  if (pronunciation) include.push('pronunciation guide');
  if (synonyms)     include.push('synonyms');
  if (antonyms)     include.push('antonyms');
  if (mnemonic)     include.push('memory trick');
  if (partOfSpeech) include.push('part of speech');

  const system = `You are a vocabulary teacher.
Generate a vocabulary list of ${count||20} ${level||'intermediate'} words/terms in ${topic}${theme}.
For each word include: ${include.join(', ')}.
Format clearly with the word as a header, then each field on its own line.`.trim();

  try {
    const list = await ask(system, `Generate ${count} ${topic} vocabulary words${theme}.`, 3000);
    res.json({ list });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── MATH ──
app.post('/api/math', async (req, res) => {
  const { problem, type, style, check, graph, similar, concept } = req.body;
  if (!problem?.trim()) return res.status(400).json({ error: 'Problem is required.' });

  const extras = [];
  if (check)   extras.push('At the end, verify the answer by checking your work.');
  if (graph)   extras.push('Describe what the graph or visual representation would look like.');
  if (similar) extras.push('At the end, provide one similar practice problem with its answer.');
  if (concept) extras.push('Before solving, briefly explain the mathematical concept involved.');

  const system = `You are an expert math tutor specializing in ${type||'math'}.
Solve the problem using: ${style||'full step-by-step solution with explanations'}.
Show ALL work clearly. Label each step.
${extras.join('\n')}`.trim();

  try {
    const solution = await ask(system, problem.trim(), 2000);
    res.json({ solution });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── TRANSLATE ──
app.post('/api/translate', async (req, res) => {
  const { text, from, to, pronunciation, grammar, formal, literal, alternatives, cultural } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Text is required.' });

  const extras = [];
  if (pronunciation)  extras.push('Include a pronunciation guide for the translation.');
  if (grammar)        extras.push('Add grammar notes explaining the structure.');
  if (formal)         extras.push('Show both formal and informal versions if they differ.');
  if (literal)        extras.push('Include the literal word-for-word translation.');
  if (alternatives)   extras.push('Suggest 1-2 alternative ways to say the same thing.');
  if (cultural)       extras.push('Add any relevant cultural context or notes.');

  const system = `You are an expert translator and language teacher.
Translate from ${from||'English'} to ${to||'Spanish'}.
First provide the translation clearly, then add the requested extras.
${extras.join('\n')}`.trim();

  try {
    const translation = await ask(system, `Translate: "${text.trim()}"`, 1500);
    res.json({ translation });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GRAMMAR CHECK ──
app.post('/api/grammar', async (req, res) => {
  const { text, lang, type, correct, explain, score, suggestions, rewrite } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Text is required.' });

  const tasks = [];
  if (correct)     tasks.push('List all grammar and spelling errors found with corrections.');
  if (explain)     tasks.push('Explain why each error is wrong and what the rule is.');
  if (score)       tasks.push('Give an overall grammar score out of 10 with brief justification.');
  if (suggestions) tasks.push('Provide style suggestions to improve clarity and flow.');
  if (rewrite)     tasks.push('At the end, provide a fully corrected and improved version.');

  const system = `You are an expert ${lang||'English'} grammar teacher.
Perform a ${type||'grammar and spelling'} check on the provided text.
${tasks.join('\n')}
Be specific about line locations and give helpful, encouraging feedback.`.trim();

  try {
    const result = await ask(system, `Please check this text:\n\n"${text.trim()}"`, 2000);
    res.json({ result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SUMMARIZE ──
app.post('/api/summarize', async (req, res) => {
  const { text, length, style, keypoints, vocabulary, questions, theme, quote } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Text is required.' });

  const extras = [];
  if (keypoints)  extras.push('List the key points / main takeaways.');
  if (vocabulary) extras.push('List any important vocabulary or terms from the text.');
  if (questions)  extras.push('Provide 3 comprehension questions about the text.');
  if (theme)      extras.push('Identify the main theme or argument of the text.');
  if (quote)      extras.push('Pull out the single most important or powerful quote.');

  const system = `You are an expert at summarizing text.
Provide ${length||'a short paragraph'} summary in a ${style||'simple and clear'} style.
${extras.join('\n')}`.trim();

  try {
    const summary = await ask(system, `Summarize this text:\n\n${text.trim()}`, 1500);
    res.json({ summary });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DEBATE ──
app.post('/api/debate', async (req, res) => {
  const { topic, depth, level, evidence, verdict, counterarguments, quotes } = req.body;
  if (!topic?.trim()) return res.status(400).json({ error: 'Topic is required.' });

  const extras = [];
  if (evidence)         extras.push('Support each point with real evidence or examples.');
  if (verdict)          extras.push('End with a balanced, neutral verdict summarizing both sides.');
  if (counterarguments) extras.push('For each side, include one counterargument from the opposing side.');
  if (quotes)           extras.push('Include a relevant quote for each side if possible.');

  const system = `You are an expert debate coach and critical thinker.
Present ${depth||'5 points per side'} for BOTH sides of this debate topic.
Level: ${level||'high school'}.
Format clearly with "PRO / FOR:" and "CON / AGAINST:" sections.
${extras.join('\n')}`.trim();

  try {
    const result = await ask(system, `Debate topic: "${topic.trim()}"`, 2000);
    res.json({ result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── TIMELINE ──
app.post('/api/timeline', async (req, res) => {
  const { topic, detail, significance, people, context, impact } = req.body;
  if (!topic?.trim()) return res.status(400).json({ error: 'Topic is required.' });

  const extras = [];
  if (significance) extras.push('For each event, explain why it was significant.');
  if (people)       extras.push('Name the key people involved in each event.');
  if (context)      extras.push('Include historical context for each event.');
  if (impact)       extras.push('Note the long-term impact of major events.');

  const system = `You are an expert historian creating a timeline.
Create ${detail||'15 key events'} for the topic.
For each event, format as: [DATE/YEAR]: [EVENT NAME] — [description]
List events in chronological order.
${extras.join('\n')}`.trim();

  try {
    const timeline = await ask(system, `Create a timeline of ${topic.trim()}.`, 2500);
    res.json({ timeline });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ELI5 ──
app.post('/api/eli5', async (req, res) => {
  const { topic, age, style } = req.body;
  if (!topic?.trim()) return res.status(400).json({ error: 'Topic is required.' });

  const system = `You are an amazing teacher who can explain anything in the simplest terms.
Explain the topic as if talking to ${age||'a middle schooler'}.
Use ${style||'a fun analogy'} to make it memorable.
Avoid jargon. Use short sentences. Make it fun and engaging.`.trim();

  try {
    const explanation = await ask(system, `Explain: ${topic.trim()}`, 1000);
    res.json({ explanation });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── COMPARE ──
app.post('/api/compare', async (req, res) => {
  const { a, b, context, format, depth } = req.body;
  if (!a?.trim() || !b?.trim()) return res.status(400).json({ error: 'Both items are required.' });

  const system = `You are an expert at comparing and contrasting topics.
Compare "${a}" and "${b}"${context ? ` in the context of ${context}` : ''}.
Format: ${format||'a side-by-side comparison with clear sections'}.
Depth: ${depth||'medium (5 points each)'}.
Include similarities AND differences. Be specific and insightful.`.trim();

  try {
    const comparison = await ask(system, `Compare and contrast: "${a}" vs "${b}"`, 2000);
    res.json({ comparison });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── MIND MAP ──
app.post('/api/mindmap', async (req, res) => {
  const { topic, depth, focus } = req.body;
  if (!topic?.trim()) return res.status(400).json({ error: 'Topic is required.' });

  const system = `You are creating a text-based mind map / concept map.
Central topic: ${topic}
Structure: ${depth||'5 main branches with 3 sub-topics each'}
Focus: ${focus||'key concepts and connections'}
Format clearly using:
🔵 MAIN BRANCH
  ├── Sub-topic 1
  ├── Sub-topic 2
  └── Sub-topic 3
Show connections and relationships between ideas.`.trim();

  try {
    const mindmap = await ask(system, `Create a mind map for: ${topic.trim()}`, 2000);
    res.json({ mindmap });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
