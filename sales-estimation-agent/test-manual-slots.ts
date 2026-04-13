import { ToolMessage } from '@langchain/core/messages';

const msg = new ToolMessage({
  tool_call_id: "call_123",
  content: "{\"slots\":[{\"startTime\":\"2026-03-30T06:00:00.000Z\",\"endTime\":\"2026-03-30T06:30:00.000Z\",\"day\":\"Monday\",\"date":"30 March","time":"11:30 am\"}]}"
});

const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
const parsed = JSON.parse(content);
const valid = parsed.slots.filter((s: any) => s.startTime && new Date(s.startTime).getTime() > Date.now());
console.log(valid);
