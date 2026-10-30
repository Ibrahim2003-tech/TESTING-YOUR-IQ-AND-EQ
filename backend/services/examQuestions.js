import { randomInt } from "node:crypto";

const optionIds = ["A", "B", "C", "D"];
export const EXAM_QUESTION_COUNT = 50;
export const QUESTION_TIME_LIMIT_MS = 60_000;

const makeOptions = (answers, rotation, correctAnswer = answers[0]) => {
  const orderedAnswers = [...answers];
  const optionRotation = rotation % orderedAnswers.length;

  for (let index = 0; index < optionRotation; index += 1) {
    orderedAnswers.push(orderedAnswers.shift());
  }

  return {
    options: orderedAnswers.map((text, index) => ({ id: optionIds[index], text })),
    correctOptionId: optionIds[orderedAnswers.indexOf(correctAnswer)],
  };
};

const sequenceQuestions = [
  [[2, 4, 6, 8, 10], 12],
  [[3, 6, 12, 24, 48], 96],
  [[1, 4, 9, 16, 25], 36],
  [[20, 17, 14, 11, 8], 5],
  [[1, 1, 2, 3, 5, 8], 13],
  [[5, 10, 20, 40, 80], 160],
  [[2, 5, 8, 11, 14], 17],
  [[100, 50, 25, 12.5], 6.25],
  [[1, 8, 27, 64], 125],
  [[7, 14, 12, 24, 22, 44], 42],
];

const arithmeticQuestions = [
  ["A box holds 6 pencils. How many pencils are in 7 boxes?", 42],
  ["A 120-page book has 35 pages left. How many pages have been read?", 85],
  ["A bus carries 18 passengers. Four more board and 3 get off. How many remain?", 19],
  ["Three notebooks cost $4 each. What is the total cost?", 12],
  ["A recipe serves 4 people and uses 300 g of rice. How much rice serves 8 people?", 600],
  ["A runner completes 5 laps of 400 metres. How many metres is that?", 2000],
  ["A class has 28 students split equally into 4 teams. How many are on each team?", 7],
  ["A tank contains 45 litres. After 18 litres are used, how many remain?", 27],
  ["A train travels 60 km in one hour. How far does it travel in 3 hours at the same speed?", 180],
  ["There are 5 rows of chairs with 9 chairs in each row. How many chairs are there?", 45],
];

const logicQuestions = [
  ["All tulips in a garden are flowers. This plant is a tulip in that garden. What must be true?", ["It is a flower.", "It is a tree.", "It has red petals.", "It grows indoors."], 0],
  ["Every member of a club has an ID card. Sam is a member. What follows?", ["Sam has an ID card.", "Sam is the club leader.", "Sam owns the club.", "Sam has two cards."], 0],
  ["No metal objects are transparent. A sculpture is made entirely of metal. What follows?", ["It is not transparent.", "It is made of glass.", "It is a mirror.", "It is hollow."], 0],
  ["Some library books are novels. All novels have a story. What must be true?", ["Some library books have a story.", "Every library book is a novel.", "No novels are library books.", "Every story is a book."], 0],
  ["If the alarm rings, the light flashes. The alarm is ringing. What follows?", ["The light flashes.", "The alarm is broken.", "The room is empty.", "The light is off."], 0],
  ["A meeting happens only on weekdays. Today is Sunday. What follows?", ["The meeting does not happen today.", "The meeting starts early.", "The meeting is online.", "The meeting lasts one hour."], 0],
  ["All squares have four sides. This shape is a square. What follows?", ["It has four sides.", "It has five sides.", "It is a circle.", "It has no corners."], 0],
  ["Every package in the red box is fragile. This package is in the red box. What follows?", ["It is fragile.", "It is empty.", "It is made of glass.", "It is the largest package."], 0],
  ["No birds in this aviary can swim. Pip is a bird in this aviary. What follows?", ["Pip cannot swim.", "Pip is a fish.", "Pip can fly.", "Pip is asleep."], 0],
  ["If a file is archived, it is backed up. This file is archived. What follows?", ["It is backed up.", "It is deleted.", "It is encrypted.", "It is public."], 0],
];

const analogyQuestions = [
  ["Book is to reading as fork is to…", ["eating", "writing", "sleeping", "walking"], 0],
  ["Puppy is to dog as kitten is to…", ["cat", "rabbit", "horse", "bird"], 0],
  ["Hand is to glove as foot is to…", ["sock", "hat", "scarf", "belt"], 0],
  ["Bird is to nest as bee is to…", ["hive", "web", "den", "stable"], 0],
  ["Minute is to hour as month is to…", ["year", "week", "day", "decade"], 0],
  ["Painter is to brush as writer is to…", ["pen", "ladder", "needle", "hammer"], 0],
  ["Thermometer is to temperature as scale is to…", ["weight", "distance", "speed", "time"], 0],
  ["Seed is to plant as egg is to…", ["bird", "nest", "feather", "wing"], 0],
  ["Chapter is to book as scene is to…", ["play", "actor", "ticket", "stage"], 0],
  ["Compass is to direction as clock is to…", ["time", "sound", "light", "weather"], 0],
];

const patternQuestions = [
  ["Which number does not fit the group: 4, 9, 16, 20, 25?", ["20", "16", "9", "25"], 0],
  ["If today is Tuesday, what day will it be 10 days from now?", ["Friday", "Thursday", "Saturday", "Sunday"], 0],
  ["A shape has 3 sides. How many sides do 4 separate copies have altogether?", ["12", "7", "9", "16"], 0],
  ["Which word comes first alphabetically?", ["Apricot", "Apple", "Banana", "Berry"], 1],
  ["A clock shows 3:00. What is the smaller angle between its hands?", ["90 degrees", "45 degrees", "120 degrees", "180 degrees"], 0],
  ["If 2 machines make 2 parts in 2 minutes, how long do 4 identical machines need to make 4 parts?", ["2 minutes", "1 minute", "4 minutes", "8 minutes"], 0],
  ["Which fraction is greatest?", ["3/4", "2/3", "5/8", "1/2"], 0],
  ["A rectangle is 5 units long and 3 units wide. What is its perimeter?", ["16 units", "8 units", "15 units", "30 units"], 0],
  ["There are 12 apples. Half are green. How many are not green?", ["6", "4", "8", "10"], 0],
  ["If every second letter is removed from the sequence A B C D E F, which letters remain?", ["A C E", "B D F", "A D F", "C D E"], 0],
];

const sequenceOptionSets = [
  (answer) => [answer, answer + 2, answer + 4, answer - 2],
  (answer) => [answer, answer / 2, answer + 12, answer - 12],
  (answer) => [answer, answer - 1, answer + 1, answer + 4],
  (answer) => [answer, answer + 3, answer - 3, answer - 6],
];

const makeIQQuestions = () => {
  const questions = [];
  let number = 1;

  for (const [sequence, answer] of sequenceQuestions) {
    const options = makeOptions(sequenceOptionSets[number % sequenceOptionSets.length](answer).map(String), number);
    questions.push({
      id: `IQ-${String(number).padStart(3, "0")}`,
      text: `What number comes next in this sequence: ${sequence.join(", ")}?`,
      ...options,
    });
    number += 1;
  }

  for (const [text, answer] of arithmeticQuestions) {
    const options = makeOptions([answer, answer + 5, answer - 5, answer * 2].map(String), number);
    questions.push({ id: `IQ-${String(number).padStart(3, "0")}`, text, ...options });
    number += 1;
  }

  for (const [text, choices, correctIndex] of logicQuestions) {
    const options = makeOptions(choices, number, choices[correctIndex]);
    questions.push({ id: `IQ-${String(number).padStart(3, "0")}`, text, ...options });
    number += 1;
  }

  for (const [text, choices, correctIndex] of analogyQuestions) {
    const options = makeOptions(choices, number, choices[correctIndex]);
    questions.push({ id: `IQ-${String(number).padStart(3, "0")}`, text, ...options });
    number += 1;
  }

  for (const [text, choices, correctIndex] of patternQuestions) {
    const options = makeOptions(choices, number, choices[correctIndex]);
    questions.push({ id: `IQ-${String(number).padStart(3, "0")}`, text, ...options });
    number += 1;
  }

  return questions;
};

const eqScenarios = [
  "A teammate says they feel overwhelmed by an upcoming deadline.",
  "A classmate gives feedback that you find difficult to hear.",
  "Two colleagues disagree about how to divide a shared task.",
  "A friend has become quiet after receiving disappointing news.",
  "Someone interrupts you repeatedly during a group discussion.",
  "A teammate makes a mistake that delays work everyone depends on.",
  "You notice that a new student is left out of a group activity.",
  "A colleague asks you to take on extra work when your schedule is full.",
  "A team member seems frustrated but has not explained why.",
  "You receive criticism in front of other people.",
  "A friend cancels plans at the last minute for the second time.",
  "A group partner has not completed their part of a project.",
  "Someone shares an opinion that is very different from yours.",
  "A teammate looks anxious before presenting to a group.",
  "You realize a comment you made may have hurt someone's feelings.",
  "A colleague takes credit for an idea you contributed.",
  "A friend asks for advice about a personal problem.",
  "A meeting becomes tense when people speak over one another.",
  "Someone on your team is struggling to understand new instructions.",
  "A peer is upset because they were not chosen for an opportunity.",
  "A colleague responds sharply to a reasonable question.",
  "You and a friend remember the same disagreement differently.",
  "A teammate is quiet and disengaged during a collaborative task.",
  "You need to give constructive feedback about repeated lateness.",
  "A friend tells you they feel excluded from a social group.",
  "Another person asks you to keep a secret that affects a teammate.",
  "A group member dismisses someone else's suggestion without listening.",
  "You notice that a coworker has been unusually stressed this week.",
  "A friend asks you to change a plan that you were looking forward to.",
  "A teammate misunderstands your written message and feels criticized.",
  "Someone apologizes after speaking impatiently to you.",
  "A group needs to decide between two plans that different people prefer.",
  "A colleague asks for help while you are working on an urgent task.",
  "A friend shares a success while you are having a difficult day.",
  "A teammate misses an important detail and wants to discuss what happened.",
  "You disagree with a group decision but still need to help carry it out.",
  "A new colleague makes a suggestion that the team has already tried.",
  "Someone becomes emotional while explaining a difficult situation.",
  "A peer asks you to review their work shortly before a deadline.",
  "A group member is receiving more speaking time than anyone else.",
  "A friend is disappointed that you cannot attend an event.",
  "A colleague misunderstands a task and begins working in the wrong direction.",
  "A teammate asks for honest feedback on a first draft.",
  "Someone is upset because a change was announced without much explanation.",
  "A peer makes a joke that another person finds uncomfortable.",
  "You feel frustrated when a group repeatedly changes its plans.",
  "A teammate says that their contribution has not been recognized.",
  "A friend asks you to listen without offering advice.",
  "A colleague disagrees with your approach during a busy project.",
  "You discover that two people in a group have conflicting expectations.",
];

const eqResponses = [
  "Listen calmly, ask what they need, and agree on a respectful next step.",
  "Assume you understand the situation and tell them what they should do.",
  "Ignore the concern and hope it resolves without a conversation.",
  "Blame the person in front of the group so everyone knows your view.",
];

const makeEQQuestions = () =>
  eqScenarios.map((scenario, index) => {
    const options = makeOptions(eqResponses, index);
    return {
      id: `EQ-${String(index + 1).padStart(3, "0")}`,
      text: scenario,
      ...options,
    };
  });

const generatedIQQuestions = Array.from({ length: 1950 }, (_, index) => {
  const variant = Math.floor(index / 5);
  const family = index % 5;
  const questionNumber = index + 51;
  const id = `IQ-${String(questionNumber).padStart(4, "0")}`;
  let text;
  let choices;

  if (family === 0) {
    const start = 3 + variant * 2;
    const step = 2 + (variant % 11);
    const termCount = 4 + (variant % 3);
    const sequence = Array.from({ length: termCount }, (_, term) => start + step * term);
    const answer = start + step * termCount;
    text = `A number sequence begins ${sequence.join(", ")}. If the same rule continues, what is the next number?`;
    choices = [answer, answer + step, answer - step, answer + step * 2].map(String);
  } else if (family === 1) {
    const ratioFirst = 2 + (variant % 7);
    const ratioSecond = 3 + (Math.floor(variant / 7) % 8);
    const multiplier = 2 + (Math.floor(variant / 56) % 9);
    const total = (ratioFirst + ratioSecond) * multiplier;
    const answer = ratioFirst * multiplier;
    text = `A project team divides ${total} tasks between two groups in the ratio ${ratioFirst}:${ratioSecond}. How many tasks go to the first group?`;
    choices = [answer, answer + multiplier, answer - multiplier, answer + multiplier * 2].map(String);
  } else if (family === 2) {
    const pagesPerMinute = 2 + (variant % 9);
    const printers = 2 + (Math.floor(variant / 9) % 7);
    const minutes = 3 + (Math.floor(variant / 63) % 12);
    const answer = pagesPerMinute * printers * minutes;
    text = `A printer produces ${pagesPerMinute} pages per minute. At the same rate, how many pages can ${printers} printers produce in ${minutes} minutes?`;
    choices = [
      answer,
      answer + pagesPerMinute,
      answer - pagesPerMinute,
      answer + pagesPerMinute * 2,
    ].map(String);
  } else if (family === 3) {
    const groups = [
      ["pilot program", "expanded program"],
      ["new schedule", "previous schedule"],
      ["updated process", "current process"],
      ["training plan", "standard plan"],
      ["delivery route", "original route"],
      ["study method", "usual method"],
      ["support service", "existing service"],
      ["team structure", "former structure"],
      ["product design", "earlier design"],
      ["appointment system", "old system"],
      ["online course", "in-person course"],
      ["community project", "comparison project"],
      ["customer survey", "earlier survey"],
      ["maintenance plan", "previous plan"],
      ["revised policy", "current policy"],
      ["public campaign", "previous campaign"],
      ["workshop format", "usual format"],
      ["recruitment method", "earlier method"],
      ["health program", "comparison program"],
      ["budget proposal", "previous budget"],
    ];
    const [newPlan, comparisonPlan] = groups[variant % groups.length];
    const participants = 20 + (variant % 23) * 5;
    text = `A report says the ${newPlan} improved results for ${participants} participants compared with the ${comparisonPlan}. Which additional information would best help determine whether the new plan caused the improvement?`;
    choices = [
      "Whether participants were assigned fairly and the groups started with similar conditions.",
      "Whether the report used an attractive layout and clear headings.",
      "Whether the people running the new plan expected it to work.",
      "Whether participants can recall the name of the new plan.",
    ];
  } else {
    const subjects = [
      ["is marked urgent", "will be reviewed today", "is marked urgent", "will be reviewed today"],
      ["is marked complete", "is eligible for approval", "is marked complete", "is eligible for approval"],
      ["has passed inspection", "is safe to use", "has passed inspection", "is safe to use"],
      ["was submitted on time", "will be included in the report", "was submitted on time", "will be included in the report"],
      ["holds a current certificate", "is allowed to operate", "holds a current certificate", "is allowed to operate"],
      ["measures below the limit", "is within policy", "measures below the limit", "is within policy"],
      ["has been verified", "will be added to the register", "has been verified", "will be added to the register"],
      ["meets the access standard", "is available to all staff", "meets the access standard", "is available to all staff"],
      ["has approval", "is scheduled for release", "has approval", "is scheduled for release"],
      ["is encrypted", "is protected at rest", "is encrypted", "is protected at rest"],
    ];
    const [condition, outcome, subjectCondition, subjectOutcome] = subjects[variant % subjects.length];
    const item = `case ${variant + 1}`;
    text = `Every ${item} that ${condition} ${outcome}. This ${item} ${subjectCondition}. What must be true?`;
    choices = [
      `This ${item} ${subjectOutcome}.`,
      `Every ${item} is ${subjectOutcome}.`,
      `This ${item} has no other requirements.`,
      `Every ${item} that is not ${condition} is also ${subjectOutcome}.`,
    ];
  }

  return {
    id,
    text,
    ...makeOptions(choices, variant),
  };
});

const eqContextDetails = [
  "other people are listening",
  "you have only a few minutes before the next task",
  "you are communicating by text",
  "you are on a remote call",
  "the person has just received unexpected news",
  "you have both had a demanding day",
  "a shared deadline is approaching",
  "the rest of the group has already moved on",
  "you are discussing what happened in private",
  "the person has not asked for advice",
  "you are responsible for coordinating the work",
  "the person is new to the group",
  "you have different expectations about the task",
  "the conversation has started to feel tense",
  "you are not sure what the person needs",
  "you have heard only one side of the story",
  "the issue may affect other team members",
  "the person is explaining their concern for the first time",
  "you disagree but still need to work together",
  "you need to respond before making a decision",
  "the person seems upset but has not explained why",
  "you realize you may have misunderstood their message",
  "you are feeling frustrated too",
  "the situation involves a change that was not expected",
  "the person has asked you to listen first",
  "there is a power difference between you",
  "you want to preserve trust while addressing the issue",
  "the group needs a decision everyone can understand",
  "you have limited information about what happened",
  "the person has made a mistake that can still be corrected",
  "you need to set a boundary without escalating the conflict",
  "you have received feedback you did not expect",
  "the person may be worried about being judged",
  "you have a different view of what would be fair",
  "you need to check facts before assigning responsibility",
  "the person has been interrupted more than once",
  "you can offer practical help but should not take over",
  "the discussion includes people with different needs",
  "you need to address the concern respectfully",
];
const eqGeneratedResponses = [
  "Ask an open question, listen without interrupting, acknowledge their perspective, and agree on a practical next step.",
  "Offer a solution immediately without checking what they need or whether they want advice.",
  "Defend your intentions and focus on proving that their reaction is unreasonable.",
  "Avoid speaking with them and ask other people to decide who is at fault.",
];
const generatedEQQuestions = Array.from({ length: 1950 }, (_, index) => {
  const scenario = eqScenarios[index % eqScenarios.length];
  const context = eqContextDetails[Math.floor(index / eqScenarios.length)];
  const variant = Math.floor(index / eqScenarios.length);
  return {
    id: `EQ-${String(index + 51).padStart(4, "0")}`,
    text: `${scenario} The conversation is taking place while ${context}. What is the most constructive first response?`,
    ...makeOptions(eqGeneratedResponses, variant + index),
  };
});

const questionBanks = {
  IQ: [...makeIQQuestions(), ...generatedIQQuestions],
  EQ: [...makeEQQuestions(), ...generatedEQQuestions],
};

const supportedFailureReasons = [
  "tab_hidden",
  "window_blur",
  "screenshot_shortcut",
  "camera_stopped",
  "camera_disconnected",
];

const shuffle = (items) => {
  const shuffledItems = [...items];
  for (let index = shuffledItems.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [shuffledItems[index], shuffledItems[swapIndex]] = [
      shuffledItems[swapIndex],
      shuffledItems[index],
    ];
  }
  return shuffledItems;
};

export const selectExamQuestions = (
  examType,
  usedQuestionIds = [],
  count = EXAM_QUESTION_COUNT
) => {
  const questions = questionBanks[examType];
  if (!questions) return null;
  if (!Number.isInteger(count) || count < 1 || count > questions.length) {
    throw new RangeError("Question count must fit within the selected exam bank.");
  }

  const usedIds = new Set(usedQuestionIds);
  let availableQuestions = questions.filter((question) => !usedIds.has(question.id));
  const bankWasReset = availableQuestions.length < count;
  if (bankWasReset) availableQuestions = questions;

  const selectedQuestions = shuffle(availableQuestions).slice(0, count);
  const nextUsedQuestionIds = bankWasReset
    ? selectedQuestions.map((question) => question.id)
    : [...usedIds, ...selectedQuestions.map((question) => question.id)];

  return { selectedQuestions, nextUsedQuestionIds, bankWasReset };
};

export const getExamQuestions = (examType, { includeAnswers = false } = {}) => {
  const selection = selectExamQuestions(examType);
  if (!selection) return null;

  return selection.selectedQuestions.map(({ correctOptionId, ...question }) =>
    includeAnswers ? { ...question, correctOptionId } : question
  );
};

export const getExamQuestion = (examType, questionId) =>
  questionBanks[examType]?.find((question) => question.id === questionId) ?? null;

export const validateExamAnswers = (examType, answers, failed, questions = questionBanks[examType]) => {
  if (!questions || !Array.isArray(answers) || answers.length > questions.length) {
    return "Provide valid answers for this assessment.";
  }

  const answeredIds = new Set();
  for (const item of answers) {
    const question = questions.find((candidate) => candidate.id === item?.questionId);
    if (
      !question ||
      answeredIds.has(item.questionId) ||
      (item.answer !== undefined &&
        item.answer !== null &&
        (typeof item.answer !== "string" ||
          !question.options.some((option) => option.id === item.answer)))
    ) {
      return "One or more assessment answers are invalid.";
    }
    answeredIds.add(item.questionId);
  }

  if (
    !failed &&
    (answers.length !== EXAM_QUESTION_COUNT || answeredIds.size !== EXAM_QUESTION_COUNT)
  ) {
    return `Complete all ${EXAM_QUESTION_COUNT} questions before submitting.`;
  }

  return null;
};

export const examFailureReasons = supportedFailureReasons;
