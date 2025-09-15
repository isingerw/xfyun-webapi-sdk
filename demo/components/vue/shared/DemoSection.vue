<template>
  <div class="demo-section">
    <div class="section-header">
      <h3>{{ title }}</h3>
      <div v-if="description" class="section-description">{{ description }}</div>
    </div>
    <div class="section-content">
      <slot />
    </div>
  </div>
</template>

<script>
export default {
  name: 'DemoSection',
  props: {
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      default: ''
    }
  }
}
</script>

<style scoped>
.demo-section {
  margin-bottom: 20px;
  padding: 18px;
  background: #fafafa;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
  width: 100%;
}

.section-header {
  margin-bottom: 16px;
}

.section-header h3 {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: #333;
  border-bottom: 2px solid #e6f7ff;
  padding-bottom: 8px;
}

.section-description {
  font-size: 14px;
  color: #666;
  line-height: 1.5;
}

.section-content {
  /* 内容样式由插槽内容决定 */
}

@media (max-width: 768px) {
  .demo-section {
    padding: 14px;
    margin-bottom: 16px;
  }
  
  .section-header h3 {
    font-size: 15px;
  }
}
</style>
