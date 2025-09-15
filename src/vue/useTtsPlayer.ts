import {ref, onBeforeUnmount} from 'vue';
import type {Ref} from 'vue';
import {TtsClient} from '../core/TtsClient';

export interface UseTtsPlayerOptions {
    /** 已配置的 TTS 客户端 */ client: TtsClient;
}

export interface UseTtsPlayerResult {
    /** 播放状态 */ status: Ref<'idle' | 'connecting' | 'open' | 'playing' | 'closed' | 'error'>;
    /** 音量电平（0-100） */ level: Ref<number>;
    /** 开始合成并播放 */ speak: (text: string) => Promise<void>;
    /** 暂停播放 */ pause: () => void;
    /** 恢复播放 */ resume: () => void;
    /** 停止播放并清理队列 */ stop: () => void;
    /** 触发自动播放（移动端策略需要） */ requestAutoplay: () => Promise<void> | void;
}

/**
 * TTS 播放控制（Vue 组合式 API）
 */
export function useTtsPlayer({client}: UseTtsPlayerOptions): UseTtsPlayerResult {
    const status = ref<'idle' | 'connecting' | 'open' | 'playing' | 'closed' | 'error'>('idle');
    const level = ref(0);

    // 订阅音量电平
    const onLevel = (lv: number) => (level.value = lv);
    (client as any).onLevel = onLevel;

    const timer = setInterval(() => (status.value = client.status as any), 100);
    onBeforeUnmount(() => {
        clearInterval(timer);
        (client as any).onLevel = undefined;
    });

    async function speak(text: string): Promise<void> {
        await client.speak(text);
        status.value = client.status as any;
    }

    function pause(): void {
        client.pause();
    }

    function resume(): void {
        client.resume();
    }

    function stop(): void {
        client.stop();
    }

    return {status, level, speak, pause, resume, stop, requestAutoplay: () => client.requestAutoplay()};
}
