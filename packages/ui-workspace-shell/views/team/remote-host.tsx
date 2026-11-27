import { useEffect, useRef, useState } from "react";
import { text, useTeam, useTeamAction } from "./client";
import { connectRemoteHost, teamDesktopBridge } from "./desktop";
import { Action, Field, Input, Modal, Picker } from "./ui";

export function RemoteHost() {
  const { user } = useTeam();
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("");
  const [auth, setAuth] = useState("password");
  const [password, setPassword] = useState("");
  const [server, setServer] = useState("");
  const serverEdited = useRef(false);
  useEffect(() => {
    let current = true;
    teamDesktopBridge().invoke("team:serverInfo", {}).then((info) => {
      if (current && !serverEdited.current && info.ok) setServer(info.serverUrl);
    }).catch(() => {});
    return () => { current = false; };
  }, []);
  const connect = useTeamAction(async () => {
    try {
      await connectRemoteHost({ host, port: Number(port), username, auth, password, remoteServerUrl: server, userId: user.id });
    } finally { setPassword(""); }
  });
  return <>
    <Action onClick={() => { connect.reset(); setOpen(true); }}>{text("connectRemote")}</Action>
    {open && <Modal title={text("connectRemote")} onClose={() => { if (!connect.isPending) { setPassword(""); setOpen(false); } }}>
      <p>{text("remoteHostHint")}</p>
      <Field label={text("remoteHost")}><Input value={host} onChange={(e) => setHost(e.target.value)} disabled={connect.isPending} /></Field>
      <Field label={text("remotePort")}><Input type="number" min={1} max={65535} value={port} onChange={(e) => setPort(e.target.value)} disabled={connect.isPending} /></Field>
      <Field label={text("remoteUser")}><Input value={username} onChange={(e) => setUsername(e.target.value)} disabled={connect.isPending} /></Field>
      <Field label={text("remoteAuth")}><Picker label={text("remoteAuth")} value={auth} onChange={setAuth} disabled={connect.isPending} options={[{value:"password",label:text("remotePasswordAuth")},{value:"key",label:text("remoteKeyAuth")}]} /></Field>
      <Field label={text(auth === "key" ? "remotePassphrase" : "remotePassword")}><Input type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} disabled={connect.isPending} /></Field>
      <Field label={text("remoteServer")}><Input value={server} onChange={(e) => { serverEdited.current = true; setServer(e.target.value); }} disabled={connect.isPending} /></Field>
      <small>{text("remoteServerHint")}</small>
      {connect.error && <p role="alert" className="team-error">{connect.error.message}</p>}
      {connect.isSuccess ? <><p role="status">{text("remoteConnected")}</p><Action onClick={() => setOpen(false)}>{text("close")}</Action></> :
        <Action primary disabled={connect.isPending || !host.trim() || !username.trim() || !server.trim() || (auth === "password" && !password)} onClick={() => connect.mutate()}>{text(connect.isPending ? "remoteConnecting" : "connectRemote")}</Action>}
    </Modal>}
  </>;
}
