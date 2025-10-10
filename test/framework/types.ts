export interface TestConfig {
  models: string[];
  defaultModel: string;
  serverUrl: string;
  energyTargets: {
    convergence: number;
    tolerance: number;
    minAcceptable: number;
    maxAcceptable: number;
  };
  timeouts: {
    conversation: number;
    snooze: number;
    response: number;
    energyCheck: number;
  };
  testSettings: {
    maxIterations: number;
    energySampleInterval: number;
    verbose: boolean;
    saveReports: boolean;
    reportDir: string;
    acceleratedReplenishRate: number;
  };
  snoozeSettings: {
    initialBackoff: number;
    maxBackoff: number;
    backoffMultiplier: number;
  };
}

export interface TestStep {
  action: 'send_message' | 'wait' | 'check_response' | 'check_energy' | 'verify_snooze' | 'verify_conversation_end';
  description: string;
  payload: any;
  expectedOutcome?: string;
}

export interface TestScenario {
  name: string;
  description: string;
  steps: TestStep[];
  expectedBehavior: {
    energyPattern: 'stable' | 'declining' | 'recovering';
    conversationEnd: 'natural' | 'timeout' | 'snooze' | 'mixed';
    responseCount: number | 'multiple';
  };
}

export interface EnergyDataPoint {
  timestamp: Date;
  energyLevel: number;
  status: string;
}

export interface ConversationState {
  requestId: string;
  userMessage: string;
  responses: string[];
  state: 'active' | 'snoozed' | 'ended';
  startTime: Date;
  endTime?: Date;
  snoozeUntil?: Date;
}

export interface TestResult {
  scenarioName: string;
  startTime: Date;
  endTime: Date;
  success: boolean;
  energyData: EnergyDataPoint[];
  conversations: ConversationState[];
  errors: Array<{
    timestamp: Date;
    message: string;
    stack?: string;
  }>;
  metrics: {
    averageEnergy: number;
    energyConvergence: boolean;
    conversationHandling: 'good' | 'poor' | 'mixed' | 'unknown';
    timingAccuracy: number;
  };
}

export interface ConversationResponse {
  requestId: string;
  inputMessage: string;
  responses: Array<{
    timestamp: string;
    content: string;
    energyLevel: number;
    modelUsed: string;
  }>;
  metadata: {
    totalEnergyConsumed: number;
    sleepCycles: number;
  };
  ended?: boolean;
  endedReason?: string;
}

export interface SystemStats {
  total_conversations: number;
  total_responses: number;
  avg_energy_level: number | null;
  urgent_responses: number | null;
}
