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
    misconceptionSummary: 'You might be mixing up place-value columns.',
    workedExample: 'Example: 3,540 has 3 thousands, 5 hundreds, 4 tens, and 0 ones. So 3,540 is greater than 3,450.',
    guidedPrompt: 'In 6,204, what is the value of the 2?',
    guidedAnswer: '200',
    steps: [
      {
        title: 'Step 1: Name the columns',
        explanation: 'Read left to right: thousands, hundreds, tens, ones.',
        checkpointQuestion: 'In 4,381, which digit is in the hundreds column?',
        checkpointOptions: ['3', '8', '4', '1'],
        checkpointAnswer: '3',
        alternativeHint: 'Find the hundreds column first, then read the digit in that column.',
      },
      {
        title: 'Step 2: Compare from the left',
        explanation: 'When you compare numbers, start with the biggest column.',
        checkpointQuestion: 'Which number is greater?',
        checkpointOptions: ['5,203', '5,123', 'They are equal', 'Not sure'],
        checkpointAnswer: '5,203',
        alternativeHint: 'Both have 5 thousands. Next look at hundreds: 2 hundreds is more than 1 hundred.',
      },
      {
        title: 'Step 3: Watch the middle columns',
        explanation: 'Tens and hundreds can look similar. Say the column name out loud.',
        checkpointQuestion: 'In 7,460, the 6 is worth:',
        checkpointOptions: ['6', '60', '600', '6000'],
        checkpointAnswer: '60',
        alternativeHint: 'The 6 is in the tens column, so it means 6 tens = 60.',
      },
    ],
  },
  B: {
    misconceptionSummary: 'You might be using a shortcut that does not always work.',
    workedExample: 'Example: 2,908 and 2,980. Thousands are the same. Hundreds are the same. Tens are 0 and 8, so 2,980 is greater.',
    guidedPrompt: 'Which number is greater: 8,307 or 8,370?',
    guidedAnswer: '8,370',
    steps: [
      {
        title: 'Step 1: Start with biggest column',
        explanation: 'Keep each digit in its place-value column.',
        checkpointQuestion: 'Which column do you check first?',
        checkpointOptions: ['Ones', 'Tens', 'Hundreds', 'Thousands'],
        checkpointAnswer: 'Thousands',
        alternativeHint: 'Always start at the left with the biggest value.',
      },
      {
        title: 'Step 2: Find the first difference',
        explanation: 'Move left to right and stop at the first different column.',
        checkpointQuestion: 'In 4,125 and 4,175, where is the first difference?',
        checkpointOptions: ['Thousands', 'Hundreds', 'Tens', 'Ones'],
        checkpointAnswer: 'Tens',
        alternativeHint: 'Thousands and hundreds match. Tens are 2 and 7, so that is the first difference.',
      },
      {
        title: 'Step 3: Make the decision',
        explanation: 'The number with the bigger digit at the first difference is greater.',
        checkpointQuestion: 'Which number is greater?',
        checkpointOptions: ['9,041', '9,401', 'They are equal', 'Not sure'],
        checkpointAnswer: '9,401',
        alternativeHint: 'At hundreds, 4 is greater than 0, so 9,401 is greater.',
      },
    ],
  },
  C: {
    misconceptionSummary: 'You might be giving too much importance to smaller columns.',
    workedExample: 'Example: 1,090 is greater than 1,009 because 9 tens is greater than 9 ones.',
    guidedPrompt: 'In 5,072, is the 7 worth 7 or 70?',
    guidedAnswer: '70',
    steps: [
      {
        title: 'Step 1: Bigger column matters more',
        explanation: 'A change in tens is bigger than a change in ones.',
        checkpointQuestion: 'Which change is bigger?',
        checkpointOptions: ['+1 one', '+1 ten', 'They are equal', 'Not sure'],
        checkpointAnswer: '+1 ten',
        alternativeHint: '1 ten = 10 ones.',
      },
      {
        title: 'Step 2: Same digit, different value',
        explanation: 'A digit changes value based on its column.',
        checkpointQuestion: 'In 3,604, the 6 is worth:',
        checkpointOptions: ['6', '60', '600', '6000'],
        checkpointAnswer: '600',
        alternativeHint: 'The 6 is in the hundreds column, so it is 600.',
      },
      {
        title: 'Step 3: Practice look-alike pairs',
        explanation: 'Some numbers look close, so compare by columns.',
        checkpointQuestion: 'Which number is greater?',
        checkpointOptions: ['6,090', '6,009', 'They are equal', 'Not sure'],
        checkpointAnswer: '6,090',
        alternativeHint: 'Look at tens: 9 tens is greater than 0 tens.',
      },
    ],
  },
};

export function getReteachPlan(routeType: RouteType): ReteachPlan {
  return plans[routeType];
}
