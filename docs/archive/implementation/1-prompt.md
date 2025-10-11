Let's write a software spec together. First the system, the goal of the system is to demonstrate balancing and regulating the effort or energy consumption of an LLM

For the demonstration, we will use Olama, running locally, to make LLM calls

The LLM will be given an initial prompt. Then it will run in a loop with its history kept in memory. Luke should run in an HTTP server. It should be able to receive messages by posting to the HTTP server. The message that was received will be inserted into the message history, so that the next inference takes that message into account. Let's call this loop the sensitive loop. It's the loop that senses time passing, messages coming from the outside world, etc. The loop can take a very small set of actions. It can go to sleep for up to a few seconds, maybe a minute. When sleeping, the energy replenishes. We could implement, outside the loop, we could implement an energy, a leaky bucket algorithm that gives energy to the AI. The loop receives as ephemeral messages the amount of energy available. So if it receives 100, if it sees 100, it's fully rested. If it sees, if it sees zero, then it's deplenished, it's tired. In this case, we should recommend the AI to go to sleep for as long as possible unless there's something urgent going on, then it should sleep in shorter cycles. We can allow the AI to go negative and when that this happens the status messages that we insert into the loop should be very urgent, very pressing tone. 

When performing inference, we should consume energy. If we run a Gemma 3b model, then we consume energy at a lower rate than the 8b model.  We should, for the demonstration purposes, try to measure how much budget we have on the local GPU so that if we consume, if we maintain a stable thinking rhythm, like inference rhythm, then the GPU is fully utilized. 

the model could decide to switch to the I mean the sensitive loop that receives the inputs from the world could decide to switch to a lower consumption mode meaning using a lower parameter count model like Gemma 3b instead of Olama 3b, Olama 8b . The decision could be based on the type of tasks or thinking to do. 

for the demo we for the demonstration we don't need long-term memory we can have a sliding window history of maybe a couple of messages and the the energy available or yeah the energy available messages can be ephemeral in this history so we don't need to keep them all in the array we just need to keep the thinking traces the thinking that's the model has done 

When the model receives an external request through the HTTP server, it should know what's the request ID, and that request should persist in the history of the conversation, or the loop, for a long time. The model can respond to messages by specifying the ID and this should be done through a tool call. The tool implementation should just create a folder with the conversation ID, the input message and the response messages into actually not a folder but just one JSON file.

The JSON file will be how we can observe the model thinking over time. The loop that controls the energy and the thinking does not need to be preserved.

I personally prefer TypeScript for those kind of things. I would be interested in trying out the AISDK from Vercel and I think they have an Agents SDK as well.

Now go ahead and write a specification.md file that contains everything needed for an AI model agent to implement this demo.
