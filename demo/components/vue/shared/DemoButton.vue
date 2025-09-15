<template>
  <button 
    :class="buttonClass" 
    :disabled="disabled"
    @click="handleClick"
  >
    <span v-if="loading" class="button-spinner"></span>
    <slot>{{ text }}</slot>
  </button>
</template>

<script>
export default {
  name: 'DemoButton',
  props: {
    type: {
      type: String,
      default: 'secondary',
      validator: value => ['primary', 'secondary', 'danger'].includes(value)
    },
    disabled: {
      type: Boolean,
      default: false
    },
    loading: {
      type: Boolean,
      default: false
    },
    text: {
      type: String,
      default: ''
    }
  },
  emits: ['click'],
  computed: {
    buttonClass() {
      return [
        'demo-button',
        `demo-button--${this.type}`,
        {
          'demo-button--disabled': this.disabled,
          'demo-button--loading': this.loading
        }
      ]
    }
  },
  methods: {
    handleClick(event) {
      if (!this.disabled && !this.loading) {
        this.$emit('click', event)
      }
    }
  }
}
</script>

<style scoped>
.demo-button {
  padding: 10px 20px;
  border-radius: 6px;
  border: 1px solid #d9d9d9;
  background: #fafafa;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  min-width: 120px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  position: relative;
  overflow: hidden;
}

.demo-button--primary {
  background: #1677ff;
  color: white;
  border-color: #1677ff;
}

.demo-button--primary:hover:not(.demo-button--disabled) {
  background: #4096ff;
  border-color: #4096ff;
}

.demo-button--secondary {
  background: #fff;
  color: #333;
}

.demo-button--secondary:hover:not(.demo-button--disabled) {
  background: #f0f7ff;
  border-color: #91c3ff;
}

.demo-button--danger {
  background: #ff4d4f;
  color: white;
  border-color: #ff4d4f;
}

.demo-button--danger:hover:not(.demo-button--disabled) {
  background: #ff7875;
  border-color: #ff7875;
}

.demo-button--disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.demo-button--loading {
  cursor: wait;
}

.button-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .demo-button {
    min-width: auto;
    flex: 1;
  }
}
</style>
