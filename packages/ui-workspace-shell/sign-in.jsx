import React, { useState } from 'react'
import { invoke } from '@team-workbench/multica-host/client-api'
import { ErrorNote, useAction } from './contract.js'
import brand from './assets/auth-brand-logo.svg'
import background from './assets/login-bg.png'
import illustration from './assets/login-illustration.png'
import decoration from './assets/login-decoration.png'

// Card outline and artwork come from the frozen MobileWork V2 login shell.
function CardShape() {
  return <svg aria-hidden="true" className="wb-auth-shape" viewBox="1154 356 444 330" preserveAspectRatio="none">
    <defs>
      <linearGradient id="wb-login-card-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="5%" stopColor="#d3f2ff"/>
        <stop offset="55%" stopColor="#ffffff" stopOpacity=".6"/>
      </linearGradient>
    </defs>
    <path d="M1154,372.000002L1154,670C1154,678.83655,1161.1634426,686,1169.999995,686L1582,686C1590.83655,686,1598,678.83655,1598,670L1598,406.494385C1598,397.657829,1590.83655,390.494385,1582,390.494385L1456.8504,390.494385C1452.7803,390.494385,1448.86322,388.943272,1445.89651,386.156811L1418.4072,360.3375731C1415.44049,357.5511136,1411.52341,356,1407.45331,356L1170,356C1161.16344,356,1154,363.16344,1154,372.000002Z"
      fill="url(#wb-login-card-gradient)" stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
  </svg>
}

export function SignIn({ onLogin, initialError }) {
  const [register, setRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const action = useAction()

  function submit(event) {
    event.preventDefault()
    action.run(async () => {
      if (register && password !== confirm) throw new Error('两次输入的密码不一致。')
      onLogin(await invoke(register ? 'session.register' : 'session.login', { username, password }))
    })
  }

  return <main className="wb-auth" style={{ backgroundImage: `url("${background}")` }}>
    <img className="wb-auth-logo" src={brand} alt="MobileWork"/>
    <img className="wb-auth-illustration" src={illustration} alt=""/>
    <div className="wb-auth-column">
      <div className="wb-auth-card">
        <CardShape/>
        <img className="wb-auth-decoration" src={decoration} alt=""/>
        <section className="wb-auth-content" aria-labelledby="wb-auth-title">
          <div className="wb-auth-brand">MobileWork</div>
          <p className="wb-auth-tagline">让每个员工会用AI，爱用AI，放心用AI</p>
          <h1 id="wb-auth-title">{register ? '注册账号' : '账号密码登录'}</h1>
          <p className="wb-auth-intro">登录后进入个人工作区。无需手机或邮箱验证码。</p>
          <form onSubmit={submit}>
            <label>账号<input autoFocus autoComplete="username" required minLength={2} maxLength={40}
              pattern={'[a-zA-Z0-9](?:[a-zA-Z0-9_.]|-){1,39}'} placeholder="请输入账号"
              disabled={action.busy} value={username} onChange={event => setUsername(event.target.value)}/></label>
            <label>密码<input type="password" autoComplete={register ? 'new-password' : 'current-password'}
              required minLength={8} maxLength={72} placeholder="请输入密码"
              disabled={action.busy} value={password} onChange={event => setPassword(event.target.value)}/></label>
            {register && <label>确认密码<input type="password" autoComplete="new-password" required
              placeholder="请再次输入密码" disabled={action.busy} value={confirm} onChange={event => setConfirm(event.target.value)}/></label>}
            <p className="wb-auth-hint">账号为 2–40 位字母、数字、点、下划线或短横线，密码为 8–72 位。</p>
            <ErrorNote error={action.error || initialError}/>
            <button type="submit" className="wb-primary" disabled={action.busy}>
              {action.busy ? '正在提交…' : register ? '注册并登录' : '账号密码登录'}
            </button>
          </form>
          <button type="button" className="wb-auth-switch" disabled={action.busy} onClick={() => {
            setRegister(value => !value)
            setPassword('')
            setConfirm('')
            action.clearError()
          }}>{register ? '已有账号？去登录' : '没有账号？注册账号'}</button>
        </section>
      </div>
    </div>
    <small className="wb-auth-version">版本号：团队工作台 0.1.0</small>
  </main>
}
