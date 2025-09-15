import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider } from "antd";
import IatPanel from "./IatPanel";
import TtsPanel from "./TtsPanel";
import RtasrPanel from "./RtasrPanel";
import DtsPanel from "./DtsPanel";
import TtsStreamingPanel from "./TtsStreamingPanel";

const server = "http://127.0.0.1:8083";
const defaultAuth =
  "aU54ZHlwUWlaUnJBdkVCRFB4S0ZNS2tJTGtNTDhvV3hEZ3V3eTByREp2QXVlTGNDUEFWamFJSU5COXRXaHpFTExPdEJmd1NnWFZxZGNoSVhOaGdLaUZPSlhKU1ZCeGhTejZnQVRoVXp0TEZqM1MyL0gxb1Y5U1hTbW9YQkxndEZndmw4MTdpUGMvM1Q5OVh2TUVzMHNFSHl4ZSsvM0FiQ2twK2VQSGtMaE5Va29IWFhqeGlGRnRWMHNySHVocktwV3c3Z2xsYVhIREUyQ0d4RjhHN2Rvd2lZQlpleU5YZWkyb0U0TUFJenpDTFg4T28rcXU2TENNeTRpZTg1c05vMExsMXM2MjFzaHZZRVk3YXRjTjlQYTdLNHBYNVdMZFFxTWo2NVVLRFZiTGRUdnZLM1FhSDBVYTZNaHl0b0lSc3ZIS2d6Tjl0WmpPSHBra0NlTlF0dm5hRXAzeE1JSDl1dXFCa1FvNzl0dWE2NnBZTE5jb1RxV3RxdWNpR0ZzVmZwTUo1RU4wR200REVUVVJqclQ2TStmRzMzVzlVeXd5K3FGNy9YMFJpQ3F0MkpBTytqd0ZCQ1l3dDB1Unh3WG9Rd1Irem50V2xsa082b2lnbkpMN2VqMm16a25FdmN4QXFzQzBVKzVRZ2srOUJ3UklxUFl0ZHVVRjdlU3prb0t4NUU5VUVBbVZyN2NaVlF6czhnRHVWc3lKMEZTRk1IRnJlN2N5OXl4L05YTWJ2RVJHdGFGdVdqYkxIRXFXRXBnK3JNeGpKTTVIYXhIcWxLazhzSW1FMXhDMk1TMXI2WW9UdU5vWC9zWWtNditISnk5Nk0xRzhuRGFRdHZ4Rk9tL2FGcEZXemh4aEhRZmlqK2E5emFBSlViSTRXZUlRS2p0aTk3OGdLZmgrVkxwY3M9.UEIzL3pzdkJUUDRWcXJRRGpqdEM2aWVibDRyWENIL2s4VmFqL1JUTVY2UitOZkt4dVdxeWNZVXl0eGlmWHNseHZseTQreGhyT2hqU1pPNmJ0TzBtYWFuUGF4K2xUSGMyUWJnTkxzWENiTkY1REZXSnVLa3M2QkM4cUt5Yi9vbHpUU2RhcFoxV3RIenJMNVh4elZTWS90TWlGeFdRcnVJdmlHdkZlRmt1N2JKc05jK1RJcUdMYjdUYWNJVnhudnBxMFY0UlA3dmxQWkNpZy9Sd2RRWGdQMGFQaUdkc3gySVQvVSs2RlFoc2JmSGZnQklDQ0xUQ3dnaS92SWpWelRLRnBMUCt1RGlUNVNQVkxmUEw0NGRNUUdkSDZvZ1BaTVBGN3BMWU9mWlpWdGh2a2lKZzZSR3VIRlRpK1dRaHNrYzRDbGpNRU9iOEorZUdMa2cvMEJPOGJRPT0";

function App() {
  const [serverBase] = useState<string>(
    (window as any).__SERVER_BASE__ ||
      localStorage.getItem("serverBase") ||
      server,
  );
  const [auth] = useState<string>(
    (window as any).__AUTH_CODE__ ||
      localStorage.getItem("auth") ||
      defaultAuth,
  );
  const getAuthCode = useMemo(() => () => auth, [auth]);
  const [activeTab, setActiveTab] = useState<string>("iat");

  const tabs = [
    { key: "iat", label: "语音听写 (IAT)", component: IatPanel },
    { key: "rtasr", label: "实时语音转写 (RTASR)", component: RtasrPanel },
    { key: "tts", label: "在线语音合成 (TTS)", component: TtsPanel },
    { key: "tts-streaming", label: "在线语音合成 (TTS) 流式", component: TtsStreamingPanel },
    { key: "dts", label: "长文本语音合成 (DTS)", component: DtsPanel },
  ];

  const ActiveComponent = tabs.find((tab) => tab.key === activeTab)?.component;

  return (
    <ConfigProvider theme={{ token: { colorPrimary: "#1677ff" } }}>
      <div className="react-app">
        <div className="tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={activeTab === tab.key ? "active" : ""}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="panel">
          {ActiveComponent && (
            <ActiveComponent
              serverBase={serverBase}
              getAuthCode={getAuthCode}
            />
          )}
        </div>
      </div>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
