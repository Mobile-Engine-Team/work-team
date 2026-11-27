/** @jsxImportSource react */
import type { ReactNode } from "react";
import AUTH_BRAND_MARK_SRC from "../../assets/auth-brand-logo.svg";
import { PRODUCT_COPYRIGHT, PRODUCT_NAME, PRODUCT_VERSION } from "@/react-app/shell/brand";
import { t } from "@/i18n";

import loginBackground from "../../assets/login-bg.png";
import loginIllustration from "../../assets/login-illustration.png";
import loginDecoration from "../../assets/login-decoration.png";

/** Frosted glass card shape (MasterGo 路径 2195) — gradient fill + white stroke.
 *  Rendered inline so the decorative tints resolve against the CSS token center. */
function CardShape({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="1154 356 444 330"
      width="444"
      height="330"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="login-card-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="5%" stopColor="var(--mw-login-card-start)" />
          <stop offset="55%" stopColor="var(--mw-login-card-end)" />
        </linearGradient>
      </defs>
      <path
        d="M1154,372.000002L1154,670C1154,678.83655,1161.1634426,686,1169.999995,686L1582,686C1590.83655,686,1598,678.83655,1598,670L1598,406.494385C1598,397.657829,1590.83655,390.494385,1582,390.494385L1456.8504,390.494385C1452.7803,390.494385,1448.86322,388.943272,1445.89651,386.156811L1418.4072,360.3375731C1415.44049,357.5511136,1411.52341,356,1407.4533099999999,356L1170,356C1161.1634426,356,1154,363.1634417,1154,372.000002Z"
        fill="url(#login-card-gradient)"
      />
      <path
        d="M1154,372.000002L1154,670C1154,678.83655,1161.1634426,686,1169.999995,686L1582,686C1590.83655,686,1598,678.83655,1598,670L1598,406.494385C1598,397.657829,1590.83655,390.494385,1582,390.494385L1456.8504,390.494385C1452.7803,390.494385,1448.86322,388.943272,1445.89651,386.156811L1418.4072,360.3375731C1415.44049,357.5511136,1411.52341,356,1407.4533099999999,356L1170,356C1161.1634426,356,1154,363.1634417,1154,372.000002ZM1156,372.000004L1156,670Q1156,675.79901,1160.1005049,679.89951Q1164.201007,684,1169.999995,684L1582,684Q1587.79901,684,1591.89951,679.89951Q1596,675.79901,1596,670L1596,406.494385Q1596,400.695396,1591.89951,396.594891Q1587.79901,392.494385,1582,392.494389L1456.8504,392.494385Q1449.72269,392.494385,1444.52728,387.614613L1417.03796,361.7953773Q1412.99707,358,1407.4533099999999,357.9999994L1170,358Q1164.20101,358,1160.1005058,362.1005049Q1156.0000007,366.201011,1156,372.000004Z"
        fill="white"
        fillRule="evenodd"
      />
    </svg>
  );
}

/**
 * 登录页共享外壳（短信与 OIDC 两个登录入口复用）：极光背景、左侧品牌插画、
 * 右半区居中的磨砂玻璃卡片（MasterGo 路径 2195 + 蒙版组 1）与版权行。
 * children 为卡片标题块之后的内容（错误块 + 表单/按钮区）。
 */
export function LoginShell({ cardMinHeight = 330, children }: {
  cardMinHeight?: number;
  children: ReactNode;
}) {
  return (
    <div
      className="relative min-h-screen w-full overflow-hidden bg-white"
      // 登录页是固定浅色视觉：钉死 color-scheme，避免全局深色主题
      // （html 上的 color-scheme: dark）把原生控件（协议勾选框等）
      // 按 UA 深色样式渲染成深色底。
      style={{ colorScheme: "light" }}
    >
      {/* Aurora background image (huaban-6687160687) */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url("${loginBackground}")`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" }}
      />

      {/* Decorative blurred glows (组 118773) — top-right */}
      {/* <Glow className="pointer-events-none absolute right-[-10%] top-[-60%] h-[80vh] w-[60vw] opacity-90" /> */}

      {/* 登录页与启动页共用左上角品牌标识。 */}
      <img
        src={AUTH_BRAND_MARK_SRC}
        alt={PRODUCT_NAME}
        className="pointer-events-none absolute left-10 top-6 h-8 w-auto object-contain"
      />

      {/* Left brand illustration (去 (3)) */}
      <img
        src={loginIllustration}
        alt=""
        aria-hidden
        className="pointer-events-none absolute left-7 top-[20vh] h-[68vh] max-h-[738px] w-auto max-w-[52vw] object-contain"
      />

      {/* Login card cluster — centered vertically on the right half.
          Card bbox in design: x=1154,y=356,w=444,h=330 (right-center). */}
      <div className="absolute inset-y-0 right-0 flex w-1/2 items-center justify-center pr-[6vw]">
        {/* Frosted glass card (路径 2195 + 蒙版组 1) */}
        <div
          className="relative flex flex-col items-center"
          style={{
            width: 444,
            minHeight: cardMinHeight,
            boxShadow: "0px 4px 62px 0px color-mix(in srgb, var(--mw-brand-light) 42%, transparent)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            borderRadius: "16px",
            padding: "44px 32px 36px",
          }}
        >
          <CardShape className="pointer-events-none absolute inset-0 z-0 h-full w-full rounded-[16px]" />
          {/* Decorative tilt element (06754) */}
          <img
            src={loginDecoration}
            alt=""
            aria-hidden
            className="pointer-events-none absolute -right-3 -top-7 z-10 h-[100px] w-auto opacity-90"
            style={{ transform: "rotate(-17.61deg)" }}
          />

          <div className="relative z-10 flex w-full flex-1 flex-col items-center">
            {/* Title block (容器 119058) */}
            <div className="flex w-full flex-col items-start gap-6">
              <div
                className="text-[36px] font-bold leading-[40px] tracking-[0.02em]"
                style={{
                  fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
                  background: "linear-gradient(90deg, #1794FF 0%, #1794FF 50%, #39CCFD 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  display: "inline-block",
                  isolation: "isolate",
                }}
              >
                {PRODUCT_NAME}
              </div>
              <div className="text-[17px] font-normal leading-[24px] text-[#7C8085]">
                {t("login.subtitle")}
              </div>
            </div>

            {children}
          </div>
        </div>
      </div>

      {/* 底部信息条：版权居中 + 版本号右下。用 fixed 贴视口——本壳所有主要子元素
          均为 absolute、文档流高度为 0，根容器高度完全依赖 min-h-screen，absolute
          定位在其上曾出现元素落到视口外不可见的问题；fixed 相对视口，彻底绕开。 */}
      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex items-center px-6 text-xs text-[var(--mw-text-muted)]">
        <div style={{ visibility: "hidden" }} className="flex-1 text-center">{PRODUCT_COPYRIGHT}</div>
        <div className="absolute right-6 text-[var(--mw-text-version)]">版本号：{PRODUCT_NAME}~{PRODUCT_VERSION}</div>
      </div>
    </div>
  );
}
