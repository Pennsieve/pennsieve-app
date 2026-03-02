<script setup>
import { reactive, ref } from 'vue'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import IconArrowRight from '@/components/icons/IconArrowRight.vue'
import IconDocumentation from '@/components/icons/IconDocumentation.vue'
import IconStopwatch from '@/components/icons/IconStopwatch.vue'
import IconHelpMessage from '@/components/icons/IconHelpMessage.vue'

const supportForm = reactive({
  name: '',
  email: '',
  subject: '',
  message: '',
  priority: 'normal'
})

const isSubmitting = ref(false)
const submitSuccess = ref(false)
const submitError = ref('')

function openDocumentation() {
  window.open('https://docs.pennsieve.io', '_blank')
}

function joinOfficeHours() {
  window.open('https://pennmedicine.zoom.us/j/91229384998?pwd=d2h3azZnR0UrRDlyeGo5akg4dzc5dz09', '_blank')
}

async function submitSupportRequest() {
  if (!supportForm.name || !supportForm.email || !supportForm.subject || !supportForm.message) {
    submitError.value = 'Please fill in all required fields'
    return
  }

  isSubmitting.value = true
  submitError.value = ''

  try {
    // Create mailto link with form data
    const subject = encodeURIComponent(`[${supportForm.priority.toUpperCase()}] ${supportForm.subject}`)
    const body = encodeURIComponent(`
Name: ${supportForm.name}
Email: ${supportForm.email}
Priority: ${supportForm.priority}

Message:
${supportForm.message}

---
Sent from Pennsieve Support Portal
    `.trim())

    const mailtoLink = `mailto:support@pennsieve.net?subject=${subject}&body=${body}`
    
    // Open default email client
    window.location.href = mailtoLink
    
    // Show success message
    submitSuccess.value = true
    
    // Reset form after a delay
    setTimeout(() => {
      supportForm.name = ''
      supportForm.email = ''
      supportForm.subject = ''
      supportForm.message = ''
      supportForm.priority = 'normal'
      submitSuccess.value = false
    }, 3000)

  } catch (error) {
    console.error('Error submitting support request:', error)
    submitError.value = 'Failed to submit support request. Please try again.'
  } finally {
    isSubmitting.value = false
  }
}

function resetForm() {
  supportForm.name = ''
  supportForm.email = ''
  supportForm.subject = ''
  supportForm.message = ''
  supportForm.priority = 'normal'
  submitError.value = ''
  submitSuccess.value = false
}
</script>

<template>
  <div class="user-support-container">
    <div class="support-content">


      <div class="support-options">
        
        <!-- Documentation Hub -->
        <div class="support-option documentation">
          <div class="option-header">
            <div class="option-icon">
              <IconDocumentation :width="24" :height="24" />
            </div>
            <div class="option-info">
              <h3>Documentation Hub</h3>
              <p>Browse our comprehensive documentation, tutorials, and guides</p>
            </div>
          </div>
          <div class="option-actions">
            <bf-button @click="openDocumentation" class="primary">
              <span>Visit Documentation</span>
              <IconArrowRight :width="16" :height="16" style="margin-left: 8px;" />
            </bf-button>
          </div>
        </div>

        <!-- Office Hours -->
        <div class="support-option office-hours">
          <div class="option-header">
            <div class="option-icon">
              <IconStopwatch :width="24" :height="24" />
            </div>
            <div class="option-info">
              <h3>Weekly Office Hours</h3>
              <p>Join our live support session every Monday, 1:00 PM - 2:00 PM ET</p>
              <div class="office-hours-details">
                <div class="schedule-item">
                  <strong>When:</strong> Every Monday, 1:00 PM - 2:00 PM ET
                </div>
                <div class="schedule-item">
                  <strong>What:</strong> Live Q&A, troubleshooting, and feature demos
                </div>
              </div>
            </div>
          </div>
          <div class="option-actions">
            <bf-button @click="joinOfficeHours" class="primary">
              <span>Join Office Hours</span>
              <IconArrowRight :width="16" :height="16" style="margin-left: 8px;" />
            </bf-button>
          </div>
        </div>

        <!-- Email Support -->
        <div class="support-option email-support">
          <div class="option-header">
            <div class="option-icon">
              <IconHelpMessage :width="24" :height="24" />
            </div>
            <div class="option-info">
              <h3>Email Support</h3>
              <p>Send us a detailed message and we'll get back to you as soon as possible</p>
            </div>
          </div>
          
          <div class="support-form" v-if="!submitSuccess">
            <div class="support-form-content">
              <div class="form-row">
                <div class="form-field">
                  <label>Name *</label>
                  <input
                    v-model="supportForm.name"
                    type="text"
                    placeholder="Your full name"
                    class="form-input"
                  />
                </div>
                <div class="form-field">
                  <label>Email *</label>
                  <input
                    v-model="supportForm.email"
                    type="email"
                    placeholder="your.email@example.com"
                    class="form-input"
                  />
                </div>
              </div>

              <div class="form-row">
                <div class="form-field">
                  <label>Priority</label>
                  <select v-model="supportForm.priority" class="form-select">
                    <option value="low">Low - General question</option>
                    <option value="normal">Normal - Standard support</option>
                    <option value="high">High - Urgent issue</option>
                    <option value="critical">Critical - System down</option>
                  </select>
                </div>
                <div class="form-field">
                  <label>Subject *</label>
                  <input
                    v-model="supportForm.subject"
                    type="text"
                    placeholder="Brief description of your issue"
                    class="form-input"
                  />
                </div>
              </div>

              <div class="form-field">
                <label>Message *</label>
                <textarea
                  v-model="supportForm.message"
                  rows="6"
                  placeholder="Please provide detailed information about your issue, including any error messages, steps to reproduce, and your expected outcome..."
                  class="form-textarea"
                />
              </div>

              <div class="form-actions">
                <bf-button 
                  @click="submitSupportRequest" 
                  :disabled="isSubmitting"
                  class="primary"
                >
                  {{ isSubmitting ? 'Sending...' : 'Send Support Request' }}
                </bf-button>
                <bf-button @click="resetForm" class="secondary">
                  Reset Form
                </bf-button>
              </div>

              <div v-if="submitError" class="error-message">
                {{ submitError }}
              </div>
            </div>
          </div>

          <div v-else class="success-message">
            <div class="success-icon">✅</div>
            <h4>Support Request Sent!</h4>
            <p>Your default email client should have opened with a pre-filled message. Please send the email to complete your support request.</p>
            <p><strong>Email:</strong> support@pennsieve.net</p>
          </div>
        </div>
      </div>

      <!-- Additional Resources -->
      <div class="additional-resources">
        <h3>Additional Resources</h3>
        <div class="resources-grid">
          <a href="https://docs.pennsieve.io/discuss" target="_blank" class="resource-item">
            <h4>Community Forum</h4>
            <p>Connect with other Pennsieve users and share knowledge</p>
          </a>
          <a href="https://docs.pennsieve.io/reference" target="_blank" class="resource-item">
            <h4>API Documentation</h4>
            <p>Technical documentation for developers using our APIs</p>
          </a>
          <a href="https://docs.pennsieve.io/changelog" target="_blank" class="resource-item">
            <h4>Release Notes</h4>
            <p>Stay updated with the latest features and improvements</p>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.user-support-container {
  padding: 40px;
  max-width: 1000px;
  margin: 0;
}

h2 {
  font-weight: 300;
  font-size: 24px;
  color: theme.$gray_6;
  margin-bottom: 8px;
}

.support-intro {
  font-size: 16px;
  color: theme.$gray_5;
  margin-bottom: 32px;
  line-height: 1.5;
}

.support-options {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-bottom: 48px;
}

.support-option {
  border: 1px solid theme.$gray_2;
  padding: 24px;
  background: white;
  transition: all 0.2s ease;

  &:hover {
    border-color: theme.$gray_3;
  }
}

.option-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
}

.option-icon {
  flex-shrink: 0;
  margin-top: 4px;
  color: theme.$purple_1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.option-info {
  flex: 1;

  h3 {
    font-size: 18px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 8px 0;
  }

  p {
    font-size: 14px;
    color: theme.$gray_5;
    margin: 0;
    line-height: 1.4;
  }
}

.office-hours-details {
  margin-top: 12px;
  
  .schedule-item {
    font-size: 13px;
    color: theme.$gray_5;
    margin-bottom: 4px;
    
    strong {
      color: theme.$gray_6;
    }
  }
}

.option-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

// Email Support Form Styles
.support-form {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid theme.$gray_2;
}

.support-form-content {
  max-width: 600px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-field {
  margin-bottom: 16px;

  label {
    display: block;
    margin-bottom: 4px;
    font-size: 14px;
    font-weight: 500;
    color: theme.$gray_6;
  }
}

.form-input, .form-select, .form-textarea {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  padding: 8px 12px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  font-size: 14px;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: theme.$purple_2;
  }
}

.form-textarea {
  resize: vertical;
  font-family: inherit;
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.error-message {
  color: theme.$red_1;
  font-size: 14px;
  margin-top: 12px;
  padding: 8px 12px;
  background: rgba(theme.$red_1, 0.1);
  border-radius: 4px;
  border: 1px solid rgba(theme.$red_1, 0.2);
}

.success-message {
  margin-top: 16px;
  padding: 24px;
  background: rgba(theme.$green_1, 0.1);
  border: 1px solid rgba(theme.$green_1, 0.2);
  border-radius: 8px;
  text-align: center;

  .success-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  h4 {
    color: theme.$green_1;
    font-size: 18px;
    margin: 0 0 12px 0;
  }

  p {
    color: theme.$gray_6;
    font-size: 14px;
    margin: 8px 0;
    line-height: 1.4;
  }
}

// Additional Resources
.additional-resources {
  margin-top: 48px;

  h3 {
    font-size: 20px;
    font-weight: 500;
    color: theme.$gray_6;
    margin-bottom: 16px;
  }
}

.resources-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.resource-item {
  display: block;
  padding: 16px;
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  text-decoration: none;
  color: inherit;
  transition: all 0.2s ease;

  &:hover {
    background: white;
    border-color: theme.$purple_1;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    text-decoration: none;
    color: inherit;
  }

  h4 {
    font-size: 14px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 8px 0;
  }

  p {
    font-size: 13px;
    color: theme.$gray_5;
    margin: 0;
    line-height: 1.3;
  }
}

// Responsive adjustments
@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }

  .option-header {
    flex-direction: column;
    text-align: center;
  }

  .form-actions {
    flex-direction: column;
  }

  .resources-grid {
    grid-template-columns: 1fr;
  }
}
</style>