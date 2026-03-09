export type RouteType = 'A' | 'B' | 'C';

export type StepType = 'goal' | 'visual_demo' | 'guided_action' | 'checkpoint' | 'transfer_check';
export type VisualType = 'none' | 'place_value_grid' | 'compare_columns' | 'decompose_number' | 'number_line';

export interface StepInteraction {
  type: 'none' | 'place_value_select.v1' | 'compare_columns.v1' | 'decompose_number.v1';
  config?: Record<string, unknown>;
  completionRule?: { kind: string; [key: string]: unknown };
}

export interface ReteachStep {
  title: string;
  explanation: string;
  checkpointQuestion: string;
  checkpointOptions: string[];
  checkpointAnswer: string;
  alternativeHint?: string;
  stepType?: StepType;
  visualType?: VisualType;
  visualPayload?: Record<string, unknown>;
  interaction?: StepInteraction;
}

export interface ReteachPlan {
  misconceptionSummary: string;
  workedExample: string;
  guidedPrompt: string;
  guidedAnswer: string;
  steps: ReteachStep[];
}

const plans: Record<RouteType, ReteachPlan> = {
  A: {
    misconceptionSummary: 'You may be mixing up place-value columns.',
    workedExample: 'Example: 3,540 has 3 thousands, 5 hundreds, 4 tens, 0 ones. So 3,540 is bigger than 3,450.',
    guidedPrompt: 'In 6,204, what is the value of 2?',
    guidedAnswer: '200',
    steps: [
      {
        title: 'Step 1: Name each place',
        explanation: 'Read left to right: thousands, hundreds, tens, ones.',
        checkpointQuestion: 'In 4,381, what digit is in hundreds?',
        checkpointOptions: ['3', '8', '4', '1'],
        checkpointAnswer: '3',
        alternativeHint: 'Find the hundreds place first. Then read that digit.',
      },
      {
        title: 'Step 2: Start on the left',
        explanation: 'When you compare numbers, start with the biggest place.',
        checkpointQuestion: 'Which number is bigger?',
        checkpointOptions: ['5,203', '5,123', 'They are equal', 'Not sure'],
        checkpointAnswer: '5,203',
        alternativeHint: 'Both have 5 thousands. Next check hundreds: 2 hundreds is more than 1 hundred.',
      },
      {
        title: 'Step 3: Check middle places',
        explanation: 'Tens and hundreds can look similar. Say the place name out loud.',
        checkpointQuestion: 'In 7,460, what does 6 mean?',
        checkpointOptions: ['6', '60', '600', '6000'],
        checkpointAnswer: '60',
        alternativeHint: 'The 6 is in tens, so it means 60.',
      },
    ],
  },
  B: {
    misconceptionSummary: 'You may be using a shortcut that does not always work.',
    workedExample: 'Example: 2,908 and 2,980. Thousands match. Hundreds match. Tens are 0 and 8, so 2,980 is bigger.',
    guidedPrompt: 'Which number is bigger: 8,307 or 8,370?',
    guidedAnswer: '8,370',
    steps: [
      {
        title: 'Step 1: Start with biggest place',
        explanation: 'Keep each digit in its place-value column.',
        checkpointQuestion: 'Which place do you check first?',
        checkpointOptions: ['Ones', 'Tens', 'Hundreds', 'Thousands'],
        checkpointAnswer: 'Thousands',
        alternativeHint: 'Always start on the left with the biggest place.',
      },
      {
        title: 'Step 2: Find first change',
        explanation: 'Move left to right. Stop at the first place that changes.',
        checkpointQuestion: 'In 4,125 and 4,175, where do they first change?',
        checkpointOptions: ['Thousands', 'Hundreds', 'Tens', 'Ones'],
        checkpointAnswer: 'Tens',
        alternativeHint: 'Thousands and hundreds are the same. Tens are 2 and 7.',
      },
      {
        title: 'Step 3: Decide',
        explanation: 'At the first change, the bigger digit gives the bigger number.',
        checkpointQuestion: 'Which number is bigger?',
        checkpointOptions: ['9,041', '9,401', 'They are equal', 'Not sure'],
        checkpointAnswer: '9,401',
        alternativeHint: 'In hundreds, 4 is bigger than 0, so 9,401 is bigger.',
      },
    ],
  },
  C: {
    misconceptionSummary: 'You may be focusing too much on smaller places.',
    workedExample: 'Example: 1,090 is bigger than 1,009 because 9 tens is more than 9 ones.',
    guidedPrompt: 'In 5,072, is the 7 worth 7 or 70?',
    guidedAnswer: '70',
    steps: [
      {
        title: 'Step 1: Bigger places matter more',
        explanation: 'A change in tens is bigger than a change in ones.',
        checkpointQuestion: 'Which one is bigger?',
        checkpointOptions: ['+1 one', '+1 ten', 'They are equal', 'Not sure'],
        checkpointAnswer: '+1 ten',
        alternativeHint: '1 ten = 10 ones.',
      },
      {
        title: 'Step 2: Same digit, new value',
        explanation: 'A digit changes value when it moves place.',
        checkpointQuestion: 'In 3,604, what does 6 mean?',
        checkpointOptions: ['6', '60', '600', '6000'],
        checkpointAnswer: '600',
        alternativeHint: 'The 6 is in hundreds, so it means 600.',
      },
      {
        title: 'Step 3: Compare close pairs',
        explanation: 'Some numbers look close. Compare by place value.',
        checkpointQuestion: 'Which number is bigger?',
        checkpointOptions: ['6,090', '6,009', 'They are equal', 'Not sure'],
        checkpointAnswer: '6,090',
        alternativeHint: 'Check tens: 9 tens is more than 0 tens.',
      },
    ],
  },
};

export function getReteachPlan(routeType: RouteType): ReteachPlan {
  return plans[routeType];
}
