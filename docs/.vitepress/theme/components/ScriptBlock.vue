<script setup>
const props = defineProps({
  title: {
    type: String,
    default: ''
  },
  copyText: {
    type: String,
    default: ''
  }
})

async function copyJapanese() {
  const text = String(props.copyText || '').trim()
  if (!text) return

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  document.body.appendChild(textArea)
  textArea.select()
  document.execCommand('copy')
  document.body.removeChild(textArea)
}
</script>

<template>
  <div class="tk-script-block">
    <button type="button" class="tk-copy-btn" @click="copyJapanese">
      复制日文
    </button>
    <div class="tk-script-text">
      <strong>{{ title }}</strong>
      <slot />
    </div>
  </div>
</template>
