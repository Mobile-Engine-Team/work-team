import test from "node:test";
import assert from "node:assert/strict";
import { mentionRecipients } from "../packages/ui-workspace-shell/views/workbench/mention-recipients.ts";

test("首页私聊仅选中完整账号，同名成员须由邮箱区分", () => {
  const people=[
    {name:"王明",email:"ming@example.test",user_id:"a"},
    {name:"王",email:"w@example.test",user_id:"b"},
    {name:"王明",email:"ming2@example.test",user_id:"c"},
    {name:"李小华",email:"hua@example.test",user_id:"d"},
  ];
  const ids=prompt=>mentionRecipients(prompt,people,"self").map(member=>member.user_id);
  assert.deepEqual(ids("@ming2@example.test @李小华，请确认。 @ming2@example.test"),["c","d"]);
  assert.deepEqual(ids("@王 @Work 核对"),["b"]);
  assert.throws(()=>ids("@王明 请确认"),/多位成员/);
  assert.throws(()=>ids("@王小华 请确认"),/请选择/);
});
