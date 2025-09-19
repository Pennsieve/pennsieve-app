<template>
  <div class="template-gallery">
    <!-- Header with Actions -->
    <div class="gallery-header">
      <div class="header-content">
        <div class="header-text">
<!--          <h1>Template Gallery</h1>-->
          <p v-if="selectedTemplates.length === 0">Choose from predefined templates to quickly create a new model with pre-configured properties and structure.</p>
          <p v-else-if="selectedTemplates.length === 1">1 template selected - ready to create your model</p>
          <p v-else>{{ selectedTemplates.length }} templates selected - ready to create your models</p>
        </div>
        <div class="action-buttons">
          <bf-button 
            v-if="selectedTemplates.length > 0"
            @click="clearAllSelections"
            type="secondary"
          >
            Clear Selection
          </bf-button>
          <bf-button 
            :disabled="selectedTemplates.length === 0"
            @click="createModelsFromTemplates"
            type="primary"
          >
            {{ selectedTemplates.length === 1 ? 'Create Model' : `Create ${selectedTemplates.length} Models` }}
          </bf-button>
        </div>
      </div>
      
      <!-- Selected Templates Preview -->
      <div v-if="selectedTemplates.length > 0" class="selected-preview">
        <div class="selected-tags">
          <el-tag
            v-for="template in selectedTemplates"
            :key="template.id"
            closable
            @close="toggleTemplateSelection(template)"
            size="large"
            type="primary"
          >
            {{ template.display_name || template.name }}
          </el-tag>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner">Loading templates...</div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-container">
      <div class="error-message">
        <h3>Failed to load templates</h3>
        <p>{{ error }}</p>
        <bf-button @click="fetchTemplates">Retry</bf-button>
      </div>
    </div>

    <!-- Templates Grid -->
    <div v-else class="templates-container">

      <!-- Filters and Controls -->
      <div class="controls-section">
        <div class="filters">
          <div class="search-filter">
            <el-input
              v-model="searchQuery"
              placeholder="Search templates..."
              :prefix-icon="Search"
              clearable
              @input="onSearchChange"
            />
          </div>
          
          <div class="category-filter">
            <el-select
              v-model="selectedCategory"
              placeholder="All Categories"
              clearable
              @change="onCategoryChange"
            >
              <el-option
                v-for="category in availableCategories"
                :key="category"
                :value="category"
                :label="formatCategoryName(category)"
              />
            </el-select>
          </div>
          
          <div class="tag-filter">
            <el-select
              v-model="selectedTags"
              placeholder="Filter by tags..."
              multiple
              collapse-tags
              collapse-tags-tooltip
              clearable
              @change="onTagsChange"
            >
              <el-option
                v-for="tag in availableTags"
                :key="tag"
                :value="tag"
                :label="formatTagName(tag)"
              />
            </el-select>
          </div>
        </div>
        
        <div class="sort-controls">
          <div class="sort-by">
            <el-select
              v-model="sortBy"
              @change="onSortChange"
            >
              <el-option value="name" label="Name" />
              <el-option value="category" label="Category" />
              <el-option value="properties" label="Property Count" />
              <el-option value="recent" label="Recently Added" />
            </el-select>
          </div>
          
          <div class="sort-direction">
            <el-button
              :icon="sortDirection === 'asc' ? SortUp : SortDown"
              @click="toggleSortDirection"
              :title="sortDirection === 'asc' ? 'Sort Ascending' : 'Sort Descending'"
            />
          </div>
        </div>
      </div>
      
      <!-- Results Summary -->
      <div class="results-summary">
        <span class="results-count">
          {{ filteredTemplates.length }} of {{ templates.length }} templates
        </span>
        <div v-if="hasActiveFilters" class="active-filters">
          <span class="filter-label">Active filters:</span>
          <el-tag
            v-if="searchQuery"
            closable
            @close="clearSearch"
            size="small"
          >
            Search: "{{ searchQuery }}"
          </el-tag>
          <el-tag
            v-if="selectedCategory"
            closable
            @close="clearCategory"
            size="small"
          >
            Category: {{ formatCategoryName(selectedCategory) }}
          </el-tag>
          <el-tag
            v-for="tag in selectedTags"
            :key="tag"
            closable
            @close="removeTag(tag)"
            size="small"
          >
            Tag: {{ formatTagName(tag) }}
          </el-tag>
          <el-button
            v-if="hasActiveFilters"
            @click="clearAllFilters"
            size="small"
            text
          >
            Clear All
          </el-button>
        </div>
      </div>
      
      <div v-if="filteredTemplates.length === 0" class="no-templates">
        <h3>{{ templates.length === 0 ? 'No templates available' : 'No templates match your filters' }}</h3>
        <p>{{ templates.length === 0 ? 'There are currently no predefined templates available.' : 'Try adjusting your search criteria or clearing filters.' }}</p>
        <el-button v-if="hasActiveFilters" @click="clearAllFilters">
          Clear All Filters
        </el-button>
      </div>
      
      <div v-else class="templates-grid">
        <div
          v-for="template in filteredTemplates"
          :key="template.id"
          class="template-card"
          :class="{ 
            selected: isTemplateSelected(template),
            'multi-selected': selectedTemplates.length > 0 
          }"
          @click="toggleTemplateSelection(template)"
        >
          <!-- Selection Indicator -->
          <div v-if="isTemplateSelected(template)" class="selection-indicator">
            <div class="selection-check">✓</div>
          </div>
          <div class="template-preview">
            <div class="template-info">
              <h3 class="template-title">{{ template.display_name || template.name }}</h3>
              <p class="template-description">{{ template.description || 'No description available' }}</p>
              <div class="template-meta">
                <span class="property-count">
                  {{ getPropertyCount(template) }} properties
                </span>
                <span v-if="template.category" class="template-category">
                  {{ template.category }}
                </span>
              </div>
            </div>
          </div>
          
          <!-- Property Preview -->
          <div class="properties-preview">
            <h4>Properties:</h4>
            <div class="properties-list">
              <div
                v-for="[propName, property] in getTemplateProperties(template).slice(0, 4)"
                :key="propName"
                class="property-preview"
              >
                <span class="property-name">{{ property.title || propName }}</span>
                <span class="property-type">{{ property.type }}</span>
              </div>
              <div
                v-if="getTemplateProperties(template).length > 4"
                class="property-preview more-properties"
              >
                <span class="more-text">+{{ getTemplateProperties(template).length - 4 }} more</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Selection Actions -->
      <div v-if="selectedTemplate" class="selection-actions">
        <div class="selected-info">
          <h3>Selected: {{ selectedTemplate.display_name || selectedTemplate.name }}</h3>
          <p>{{ selectedTemplate.description }}</p>
        </div>
        <div class="actions">
          <bf-button @click="selectedTemplate = null">
            Clear Selection
          </bf-button>
          <bf-button type="primary" @click="useTemplate">
            Use This Template
          </bf-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElInput, ElSelect, ElOption, ElButton, ElTag, ElMessage, ElMessageBox } from 'element-plus'
import { Search, SortUp, SortDown } from '@element-plus/icons-vue'
import BfButton from "@/components/shared/bf-button/BfButton.vue"
import * as site from "@/site-config/site.json"
import { useGetToken } from "@/composables/useGetToken"
import toQueryParams from "@/utils/toQueryParams"
import { useMetadataStore } from '@/stores/metadataStore.js'

// Props
const props = defineProps({
  orgId: {
    type: String,
    required: true
  },
  datasetId: {
    type: String,
    required: true
  }
})

// Emits
const emit = defineEmits(['close', 'template-selected', 'models-created'])

// Router
const router = useRouter()

// Store
const metadataStore = useMetadataStore()

// Reactive data
const templates = ref([])
const selectedTemplate = ref(null)
const selectedTemplates = ref([])
const loading = ref(false)
const creatingModels = ref(false)
const error = ref('')

// Filter and sort state
const searchQuery = ref('')
const selectedCategory = ref('')
const selectedTags = ref([])
const sortBy = ref('name')
const sortDirection = ref('asc')

// Computed properties
const availableCategories = computed(() => {
  const categories = new Set()
  templates.value.forEach(template => {
    if (template.category) {
      categories.add(template.category)
    }
  })
  return Array.from(categories).sort()
})

const availableTags = computed(() => {
  const tags = new Set()
  templates.value.forEach(template => {
    if (template.tags) {
      template.tags.forEach(tag => tags.add(tag))
    }
  })
  return Array.from(tags).sort()
})

const hasActiveFilters = computed(() => {
  return searchQuery.value || selectedCategory.value || selectedTags.value.length > 0
})

const filteredTemplates = computed(() => {
  let filtered = templates.value

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(template => {
      const name = (template.display_name || template.name || '').toLowerCase()
      const description = (template.description || '').toLowerCase()
      const category = (template.category || '').toLowerCase()
      return name.includes(query) || description.includes(query) || category.includes(query)
    })
  }

  // Apply category filter
  if (selectedCategory.value) {
    filtered = filtered.filter(template => template.category === selectedCategory.value)
  }

  // Apply tags filter
  if (selectedTags.value.length > 0) {
    filtered = filtered.filter(template => {
      if (!template.tags) return false
      return selectedTags.value.some(selectedTag => template.tags.includes(selectedTag))
    })
  }

  // Apply sorting
  filtered = [...filtered].sort((a, b) => {
    let compareA, compareB
    
    switch (sortBy.value) {
      case 'name':
        compareA = (a.display_name || a.name || '').toLowerCase()
        compareB = (b.display_name || b.name || '').toLowerCase()
        break
      case 'category':
        compareA = (a.category || '').toLowerCase()
        compareB = (b.category || '').toLowerCase()
        break
      case 'properties':
        compareA = getPropertyCount(a)
        compareB = getPropertyCount(b)
        break
      case 'recent':
        // For now, sort by ID as a proxy for creation order
        compareA = a.id
        compareB = b.id
        break
      default:
        compareA = (a.display_name || a.name || '').toLowerCase()
        compareB = (b.display_name || b.name || '').toLowerCase()
    }
    
    if (typeof compareA === 'number' && typeof compareB === 'number') {
      return sortDirection.value === 'asc' ? compareA - compareB : compareB - compareA
    } else {
      const result = String(compareA).localeCompare(String(compareB))
      return sortDirection.value === 'asc' ? result : -result
    }
  })

  return filtered
})

// Test templates for development - remove when backend is ready
const testTemplates = [
  {
    id: 'clinical-trial-1',
    name: 'clinical_trial',
    display_name: 'Clinical Trial',
    description: 'Standard template for clinical trial metadata with patient demographics, study design, and outcome measures.',
    category: 'clinical',
    tags: ['medical', 'patient-data', 'study'],
    latest_version: {
      version: 1,
      schema: {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "required": ["study_id", "patient_id"],
        "properties": {
          "study_id": {
            "type": "string",
            "title": "Study ID",
            "description": "Unique identifier for the clinical study"
          },
          "patient_id": {
            "type": "string",
            "title": "Patient ID", 
            "description": "Anonymized patient identifier"
          },
          "age": {
            "type": "integer",
            "title": "Age",
            "description": "Patient age at enrollment",
            "minimum": 0,
            "maximum": 120
          },
          "gender": {
            "type": "string",
            "title": "Gender",
            "description": "Patient gender",
            "enum": ["male", "female", "other", "prefer_not_to_say"]
          },
          "treatment_arm": {
            "type": "string",
            "title": "Treatment Arm",
            "description": "Study treatment arm assignment"
          },
          "enrollment_date": {
            "type": "string",
            "title": "Enrollment Date",
            "description": "Date of study enrollment",
            "format": "date"
          }
        }
      }
    }
  },
  {
    id: 'neuroscience-experiment-1',
    name: 'neuroscience_experiment',
    display_name: 'Neuroscience Experiment',
    description: 'Template for neuroscience research including behavioral tasks, neural recordings, and experimental conditions.',
    category: 'neuroscience',
    tags: ['research', 'behavioral', 'neural'],
    latest_version: {
      version: 1,
      schema: {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "required": ["subject_id", "experiment_date"],
        "properties": {
          "subject_id": {
            "type": "string",
            "title": "Subject ID",
            "description": "Unique identifier for the experimental subject"
          },
          "experiment_date": {
            "type": "string",
            "title": "Experiment Date",
            "description": "Date when experiment was conducted",
            "format": "date"
          },
          "task_type": {
            "type": "string",
            "title": "Task Type",
            "description": "Type of behavioral or cognitive task",
            "enum": ["memory", "attention", "motor", "language", "decision_making"]
          },
          "recording_type": {
            "type": "string",
            "title": "Recording Type",
            "description": "Type of neural recording method",
            "enum": ["eeg", "fmri", "calcium_imaging", "electrophysiology", "behavioral_only"]
          },
          "stimulus_condition": {
            "type": "string",
            "title": "Stimulus Condition",
            "description": "Experimental stimulus condition"
          },
          "session_duration": {
            "type": "number",
            "title": "Session Duration (minutes)",
            "description": "Duration of experimental session in minutes",
            "minimum": 0
          },
          "notes": {
            "type": "string",
            "title": "Experimental Notes",
            "description": "Additional notes about the experimental session"
          }
        }
      }
    }
  },
  {
    id: 'imaging-study-1',
    name: 'imaging_study',
    display_name: 'Imaging Study',
    description: 'Template for medical and research imaging studies including scan parameters, image quality metrics, and analysis results.',
    category: 'imaging',
    tags: ['medical', 'imaging', 'scans'],
    latest_version: {
      version: 1,
      schema: {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "required": ["scan_id", "modality"],
        "properties": {
          "scan_id": {
            "type": "string",
            "title": "Scan ID",
            "description": "Unique identifier for the imaging scan"
          },
          "modality": {
            "type": "string",
            "title": "Imaging Modality",
            "description": "Type of imaging modality used",
            "enum": ["mri", "ct", "pet", "ultrasound", "xray", "microscopy"]
          },
          "acquisition_date": {
            "type": "string",
            "title": "Acquisition Date",
            "description": "Date when images were acquired",
            "format": "date-time"
          },
          "resolution": {
            "type": "string",
            "title": "Image Resolution",
            "description": "Spatial resolution of the images (e.g., 1mm x 1mm x 1mm)"
          },
          "contrast_agent": {
            "type": "boolean",
            "title": "Contrast Agent Used",
            "description": "Whether contrast agent was administered"
          },
          "field_strength": {
            "type": "string",
            "title": "Field Strength",
            "description": "Magnetic field strength for MRI (e.g., 3T, 7T)"
          },
          "slice_thickness": {
            "type": "number",
            "title": "Slice Thickness (mm)",
            "description": "Thickness of image slices in millimeters",
            "minimum": 0
          }
        }
      }
    }
  },
  {
    id: 'behavioral-assessment-1',
    name: 'behavioral_assessment',
    display_name: 'Behavioral Assessment',
    description: 'Template for behavioral and psychological assessments including questionnaires, performance metrics, and scoring.',
    category: 'behavioral',
    tags: ['psychology', 'assessment', 'testing'],
    latest_version: {
      version: 1,
      schema: {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "required": ["assessment_id", "assessment_type"],
        "properties": {
          "assessment_id": {
            "type": "string",
            "title": "Assessment ID",
            "description": "Unique identifier for the behavioral assessment"
          },
          "assessment_type": {
            "type": "string",
            "title": "Assessment Type",
            "description": "Type of behavioral assessment conducted",
            "enum": ["cognitive", "mood", "personality", "neuropsychological", "developmental"]
          },
          "test_date": {
            "type": "string",
            "title": "Test Date",
            "description": "Date when assessment was administered",
            "format": "date"
          },
          "administrator": {
            "type": "string",
            "title": "Test Administrator",
            "description": "Person who administered the assessment"
          },
          "total_score": {
            "type": "number",
            "title": "Total Score",
            "description": "Overall score from the assessment"
          },
          "percentile_rank": {
            "type": "number",
            "title": "Percentile Rank",
            "description": "Percentile ranking compared to normative sample",
            "minimum": 0,
            "maximum": 100
          },
          "completion_time": {
            "type": "number",
            "title": "Completion Time (minutes)",
            "description": "Time taken to complete assessment in minutes",
            "minimum": 0
          },
          "validity_indicators": {
            "type": "array",
            "title": "Validity Indicators",
            "description": "Indicators of assessment validity",
            "items": {
              "type": "string",
              "enum": ["valid", "invalid", "questionable", "incomplete"]
            }
          }
        }
      }
    }
  },
  {
    id: 'genomics-sample-1',
    name: 'genomics_sample',
    display_name: 'Genomics Sample',
    description: 'Template for genomics and molecular biology samples including sequencing parameters, quality metrics, and analysis workflow.',
    category: 'biology',
    tags: ['genomics', 'sequencing', 'molecular'],
    latest_version: {
      version: 1,
      schema: {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "required": ["sample_id", "sample_type"],
        "properties": {
          "sample_id": {
            "type": "string",
            "title": "Sample ID",
            "description": "Unique identifier for the biological sample"
          },
          "sample_type": {
            "type": "string",
            "title": "Sample Type",
            "description": "Type of biological sample",
            "enum": ["dna", "rna", "protein", "tissue", "blood", "saliva", "cell_culture"]
          },
          "collection_date": {
            "type": "string",
            "title": "Collection Date",
            "description": "Date when sample was collected",
            "format": "date"
          },
          "organism": {
            "type": "string",
            "title": "Organism",
            "description": "Source organism for the sample",
            "enum": ["human", "mouse", "rat", "drosophila", "c_elegans", "yeast", "other"]
          },
          "sequencing_platform": {
            "type": "string",
            "title": "Sequencing Platform",
            "description": "Platform used for sequencing",
            "enum": ["illumina", "oxford_nanopore", "pacbio", "ion_torrent", "sanger"]
          },
          "read_length": {
            "type": "integer",
            "title": "Read Length (bp)",
            "description": "Length of sequencing reads in base pairs",
            "minimum": 1
          },
          "coverage": {
            "type": "number",
            "title": "Sequencing Coverage",
            "description": "Average sequencing coverage depth",
            "minimum": 0
          },
          "quality_score": {
            "type": "number",
            "title": "Quality Score",
            "description": "Overall quality score for the sample",
            "minimum": 0,
            "maximum": 100
          }
        }
      }
    }
  }
]

// Methods
const fetchTemplates = async () => {
  loading.value = true
  error.value = ''
  
  try {
    // Use the metadata store to fetch templates with organization ID
    const fetchedTemplates = await metadataStore.fetchTemplates(props.orgId)
    
    // Transform the API response to match the expected component structure
    if (fetchedTemplates && Array.isArray(fetchedTemplates)) {
      templates.value = fetchedTemplates.map(template => ({
        id: template.model_template?.id || template.id,
        name: template.model_template?.name || template.name,
        display_name: template.model_template?.display_name || template.display_name,
        description: template.description || template.model_template?.description || '',
        category: template.category || 'general', // Default category if not provided
        tags: template.tags || [], // Default empty tags if not provided
        latest_version: template.model_template?.latest_version || template.latest_version || {
          version: 1,
          schema: template.model_template?.latest_version?.schema || template.schema || {}
        },
        created_at: template.created_at || template.model_template?.created_at
      }))
    } else {
      templates.value = []
    }
  } catch (err) {
    console.error('Error fetching templates:', err)
    error.value = err.message || 'Failed to load templates'
    
    // Fallback to test templates if API fails during development
    if (process.env.NODE_ENV === 'development') {
      console.warn('Falling back to test templates due to API error')
      templates.value = testTemplates
    } else {
      templates.value = []
    }
  } finally {
    loading.value = false
  }
}

const selectTemplate = (template) => {
  selectedTemplate.value = selectedTemplate.value?.id === template.id ? null : template
}

const useTemplate = () => {
  if (!selectedTemplate.value) return
  
  // Navigate to new-model route with template data
  router.push({
    name: 'new-model',
    params: {
      datasetId: props.datasetId,
      orgId: props.orgId,
    },
    query: {
      template: btoa(JSON.stringify(selectedTemplate.value)) // Base64 encode the template
    }
  })
}

// Multiple selection methods
const isTemplateSelected = (template) => {
  return selectedTemplates.value.some(selected => selected.id === template.id)
}

const toggleTemplateSelection = (template) => {
  const index = selectedTemplates.value.findIndex(selected => selected.id === template.id)
  
  if (index > -1) {
    // Template is already selected, remove it
    selectedTemplates.value.splice(index, 1)
  } else {
    // Template is not selected, add it
    selectedTemplates.value.push(template)
  }
}

const clearAllSelections = () => {
  selectedTemplates.value = []
}

const createModelsFromTemplates = async () => {
  if (selectedTemplates.value.length === 0) return
  
  creatingModels.value = true
  
  try {
    // Prepare templates array for API call
    const templatesArray = selectedTemplates.value.map(template => ({
      template: {
        id: template.id,
        name: template.name,
        display_name: template.display_name,
        description: template.description,
        latest_version: template.latest_version
      }
    }))
    
    // Call the store method to create models from templates
    const results = await metadataStore.createModelsFromTemplates(props.datasetId, templatesArray)
    
    // Show success/failure message
    if (results.successful.length > 0 && results.failed.length === 0) {
      ElMessage.success({
        message: `Successfully created ${results.successful.length} model${results.successful.length > 1 ? 's' : ''} from template${results.successful.length > 1 ? 's' : ''}`,
        duration: 3000
      })
      
      // Clear selections
      clearAllSelections()
      
      // Navigate to the models list or refresh the page
      // You might want to emit an event or navigate somewhere
      emit('models-created', results.successful)
      
    } else if (results.successful.length > 0 && results.failed.length > 0) {
      ElMessage.warning({
        message: `Created ${results.successful.length} model${results.successful.length > 1 ? 's' : ''}, but ${results.failed.length} failed`,
        duration: 4000
      })
    } else {
      ElMessage.error({
        message: `Failed to create models from templates`,
        duration: 3000
      })
    }
    
    // Log any failures for debugging
    if (results.failed.length > 0) {
      console.error('Failed to create models:', results.failed)
    }
    
  } catch (error) {
    console.error('Error creating models from templates:', error)
    ElMessage.error({
      message: `Error: ${error.message || 'Failed to create models'}`,
      duration: 4000
    })
  } finally {
    creatingModels.value = false
  }
}

const getPropertyCount = (template) => {
  if (!template.latest_version?.schema?.properties && !template.schema?.properties) {
    return 0
  }
  
  const properties = template.latest_version?.schema?.properties || template.schema?.properties || {}
  return Object.keys(properties).length
}

const getTemplateProperties = (template) => {
  if (!template.latest_version?.schema?.properties && !template.schema?.properties) {
    return []
  }
  
  const properties = template.latest_version?.schema?.properties || template.schema?.properties || {}
  return Object.entries(properties)
}

// Event handlers
const onSearchChange = () => {
  // Automatically handled by computed filteredTemplates
}

const onCategoryChange = () => {
  // Automatically handled by computed filteredTemplates
}

const onTagsChange = () => {
  // Automatically handled by computed filteredTemplates
}

const onSortChange = () => {
  // Automatically handled by computed filteredTemplates
}

const toggleSortDirection = () => {
  sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
}

// Helper functions
const formatCategoryName = (category) => {
  return category.charAt(0).toUpperCase() + category.slice(1).replace(/[_-]/g, ' ')
}

const formatTagName = (tag) => {
  return tag.charAt(0).toUpperCase() + tag.slice(1).replace(/[_-]/g, ' ')
}

// Filter clearing functions
const clearSearch = () => {
  searchQuery.value = ''
}

const clearCategory = () => {
  selectedCategory.value = ''
}

const removeTag = (tag) => {
  const index = selectedTags.value.indexOf(tag)
  if (index > -1) {
    selectedTags.value.splice(index, 1)
  }
}

const clearAllFilters = () => {
  searchQuery.value = ''
  selectedCategory.value = ''
  selectedTags.value = []
}

// Lifecycle
onMounted(() => {
  fetchTemplates()
})
</script>

<style lang="scss" scoped>
@use '../../../../styles/theme' as theme;
@use '../../../../styles/element/tag';

.template-gallery {
  padding: 24px;
  
  .gallery-header {
    margin-bottom: 32px;
    
    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      margin-bottom: 16px;
      
      .header-text {
        flex: 1;
        
        h1 {
          font-size: 28px;
          font-weight: 600;
          color: theme.$gray_6;
          margin: 0 0 8px 0;
        }
        
        p {
          color: theme.$gray_5;
          margin: 0;
          font-size: 16px;
        }
      }
      
      .action-buttons {
        display: flex;
        gap: 12px;
        align-items: center;
      }
    }
    
    .selected-preview {
      .selected-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        
        :deep(.el-tag) {
          margin-right: 0;
          --el-tag-border-radius: 0px;
          --el-tag-text-color: #{theme.$purple_3};
          --el-tag-bg-color: #{theme.$purple_tint};
          --el-tag-border-color: #{theme.$purple_2};
        }
      }
    }
  }
  
  .loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 400px;
    
    .loading-spinner {
      font-size: 18px;
      color: theme.$gray_5;
    }
  }
  
  .error-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 400px;
    
    .error-message {
      text-align: center;
      
      h3 {
        color: theme.$red_1;
        margin-bottom: 8px;
      }
      
      p {
        color: theme.$gray_5;
        margin-bottom: 16px;
      }
    }
  }
  
  .templates-container {
    .primary-action-section {
      background: theme.$gray_1;
      border: 1px solid theme.$gray_2;
      //border-radius: 8px;
      padding: 24px;
      margin-bottom: 32px;
      
      .action-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 24px;
        margin-bottom: 16px;
        
        .selection-info {
          flex: 1;
          
          h3 {
            font-size: 20px;
            font-weight: 600;
            color: theme.$gray_6;
            margin: 0 0 8px 0;
          }
          
          p {
            font-size: 14px;
            color: theme.$gray_5;
            margin: 0;
          }
        }
        
        .action-buttons {
          display: flex;
          gap: 12px;
          align-items: center;
        }
      }
      
      .selected-preview {
        h4 {
          font-size: 16px;
          font-weight: 500;
          color: theme.$gray_6;
          margin: 0 0 12px 0;
        }
        
        .selected-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          
          .el-tag {
            margin-right: 0;
          }
        }
      }
    }
    
    .controls-section {
      margin-bottom: 32px;
      
      .filters {
        display: flex;
        gap: 16px;
        margin-bottom: 16px;
        flex-wrap: wrap;
        
        .search-filter {
          min-width: 300px;
          flex: 1;
        }
        
        .category-filter,
        .tag-filter {
          min-width: 200px;
        }
      }
      
      .sort-controls {
        display: flex;
        gap: 8px;
        align-items: center;
        
        .sort-by {
          min-width: 150px;
        }
      }
    }
    
    .results-summary {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      gap: 24px;
      
      .results-count {
        font-size: 14px;
        color: theme.$gray_5;
        font-weight: 500;
      }
      
      .active-filters {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        
        .filter-label {
          font-size: 12px;
          color: theme.$gray_4;
          margin-right: 4px;
        }
        
        :deep(.el-tag) {
          margin-right: 4px;
          --el-tag-border-radius: 0px;
          --el-tag-text-color: #{theme.$purple_3};
          --el-tag-bg-color: #{theme.$purple_tint};
          --el-tag-border-color: #{theme.$purple_2};
        }
      }
    }
    
    .no-templates {
      text-align: center;
      padding: 64px 24px;
      color: theme.$gray_5;
      
      h3 {
        margin-bottom: 8px;
      }
    }
    
    .templates-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
      gap: 24px;
      margin-bottom: 32px;
    }
  }
  
  .template-card {
    border: 2px solid theme.$gray_2;
    //border-radius: 8px;
    padding: 24px;
    cursor: pointer;
    transition: all 0.2s ease;
    background: theme.$white;
    position: relative;
    
    &:hover {
      border-color: theme.$purple_3;
      //box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    
    &.selected {
      border-color: theme.$purple_2;
      background: theme.$purple_tint;
      //box-shadow: 0 4px 16px rgba(71, 69, 255, 0.15);
    }
    
    &.multi-selected:not(.selected) {
      opacity: 0.7;
    }
    
    .selection-indicator {
      position: absolute;
      top: 16px;
      right: 16px;
      
      .selection-check {
        width: 24px;
        height: 24px;
        background: theme.$purple_2;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 600;
        //box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }
    }
    
    .template-preview {
      margin-bottom: 20px;
      
      .template-info {
        
        .template-title {
          font-size: 18px;
          font-weight: 600;
          color: theme.$gray_6;
          margin: 0 0 8px 0;
        }
        
        .template-description {
          font-size: 14px;
          color: theme.$gray_5;
          margin: 0 0 12px 0;
          line-height: 1.4;
        }
        
        .template-meta {
          display: flex;
          gap: 16px;
          
          .property-count {
            font-size: 12px;
            color: theme.$purple_3;
            background: theme.$purple_tint;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 500;
          }
          
          .template-category {
            font-size: 12px;
            color: theme.$gray_5;
            background: theme.$gray_1;
            padding: 4px 8px;
            //border-radius: 4px;
          }
        }
      }
    }
    
    .properties-preview {
      border-top: 1px solid theme.$gray_2;
      padding-top: 16px;
      
      h4 {
        font-size: 14px;
        font-weight: 600;
        color: theme.$gray_6;
        margin: 0 0 12px 0;
      }
      
      .properties-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .property-preview {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 13px;
        
        .property-name {
          color: theme.$gray_6;
          font-weight: 500;
        }
        
        .property-type {
          color: theme.$gray_5;
          background: theme.$gray_1;
          padding: 2px 6px;
          //border-radius: 3px;
          font-size: 11px;
        }
        
        &.more-properties {
          .more-text {
            color: theme.$gray_4;
            font-style: italic;
          }
        }
      }
    }
  }
  
  .selection-actions {
    border-top: 2px solid theme.$gray_2;
    padding-top: 24px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
    
    .selected-info {
      flex: 1;
      
      h3 {
        font-size: 18px;
        color: theme.$gray_6;
        margin: 0 0 8px 0;
      }
      
      p {
        color: theme.$gray_5;
        margin: 0;
        font-size: 14px;
      }
    }
    
    .actions {
      display: flex;
      gap: 12px;
    }
  }
}
</style>