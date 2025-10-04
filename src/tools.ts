import * as fs from 'fs-extra';
import * as path from 'path';

const CONVERSATIONS_DIR = path.join(process.cwd(), 'conversations');

interface ConversationData {
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
    modelSwitches: number;
  };
}

export async function respond(requestId: string, content: string, energyLevel: number, modelUsed: string, modelSwitches: number) {
  try {
    await fs.ensureDir(CONVERSATIONS_DIR);

    const filePath = path.join(CONVERSATIONS_DIR, `${requestId}.json`);

    let data: ConversationData;

    if (await fs.pathExists(filePath)) {
      // Load existing conversation
      const existing = await fs.readJson(filePath);
      data = existing;
    } else {
      // Initialize new conversation (we'll need to get the input message somehow)
      // For now, create with placeholder
      data = {
        requestId,
        inputMessage: 'Input message to be populated', // TODO: Pass this in
        responses: [],
        metadata: {
          totalEnergyConsumed: 0,
          sleepCycles: 0,
          modelSwitches: 0
        }
      };
    }

    // Add response
    data.responses.push({
      timestamp: new Date().toISOString(),
      content,
      energyLevel,
      modelUsed
    });

    // Update metadata
    data.metadata.modelSwitches = modelSwitches;

    // Save to file
    await fs.writeJson(filePath, data, { spaces: 2 });

    console.log(`Response saved to ${filePath}`);

  } catch (error) {
    console.error('Error saving response:', error);
  }
}
