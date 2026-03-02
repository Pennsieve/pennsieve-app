/**
 * Composable for model data management
 * Handles model data computation, schema processing, and default data
 */

import { computed } from 'vue'

export function useModelData(props, model, currentVersionData, selectedVersion) {
  
  // Default schema template
  const defaultSchema = {
    "type": "object",
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "properties": {}
  }

  // Test data with diverse data types and three levels of nesting
  const testModel = {
    "id": "085a6d55-2681-4a2d-9206-4d656c1accf9",
    "name": "drug",
    "display_name": "Clinical Drug",
    "description": "Comprehensive drug information model with diverse data types",
    "created_at": "2025-07-18T16:01:08.852253Z",
    "latest_version": {
      "version": 1,
      "schema": {
        "type": "object",
        "title": "drug",
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "required": [
          "drug_id",
          "name",
          "is_approved",
          "approval_date"
        ],
        "properties": {
          "drug_id": {
            "type": "integer",
            "x-pennsieve-key": true,
            "description": "Unique identifier"
          },
          "name": {
            "type": "string",
            "x-pennsieve-key": true,
            "description": "Drug commercial name",
            "minLength": 3,
            "maxLength": 100
          },
          "is_approved": {
            "type": "boolean",
            "description": "FDA approval status"
          },
          "approval_date": {
            "type": "string",
            "format": "date",
            "description": "Date of FDA approval (YYYY-MM-DD)"
          },
          "expiration_datetime": {
            "type": "string",
            "format": "date-time",
            "description": "Expiration timestamp (ISO 8601)"
          },
          "daily_dose_time": {
            "type": "string",
            "format": "time",
            "description": "Recommended administration time (HH:MM:SS)",
            "default": "08:00:00"
          },
          "price": {
            "type": "number",
            "description": "Retail price in USD",
            "minimum": 0,
            "multipleOf": 0.01,
            "x-pennsieve-sensitive": true
          },
          "concentration_mg": {
            "type": "integer",
            "description": "Active ingredient concentration in milligrams",
            "minimum": 0,
            "maximum": 10000
          },
          "ph_level": {
            "type": "number",
            "description": "Solution pH level",
            "minimum": 0,
            "maximum": 14
          },
          "clinical_data": {
            "type": "object",
            "required": ["trial_phase", "efficacy_rate"],
            "properties": {
              "trial_phase": {
                "type": "integer",
                "minimum": 1,
                "maximum": 4,
                "description": "Clinical trial phase (1-4)"
              },
              "efficacy_rate": {
                "type": "number",
                "minimum": 0,
                "maximum": 100,
                "description": "Efficacy percentage"
              },
              "trial_start_date": {
                "type": "string",
                "format": "date",
                "description": "Trial start date"
              },
              "trial_duration_days": {
                "type": "integer",
                "description": "Duration of trial in days"
              },
              "double_blind": {
                "type": "boolean",
                "description": "Was trial double-blind"
              },
              "participants": {
                "type": "object",
                "properties": {
                  "total_enrolled": {
                    "type": "integer",
                    "minimum": 0
                  },
                  "completed": {
                    "type": "integer",
                    "minimum": 0
                  },
                  "dropout_rate": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 100,
                    "description": "Percentage who dropped out"
                  },
                  "demographics": {
                    "type": "object",
                    "properties": {
                      "average_age": {
                        "type": "number",
                        "description": "Mean age of participants"
                      },
                      "age_range": {
                        "type": "object",
                        "properties": {
                          "min": { 
                            "type": "integer", 
                            "minimum": 0,
                            "maximum": 100,
                            "description": "Minimum age of participants",
                            "default": 18
                          },
                          "max": { 
                            "type": "integer", 
                            "minimum": 18,
                            "maximum": 120,
                            "description": "Maximum age of participants",
                            "default": 65
                          }
                        }
                      },
                      "male_percentage": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 100,
                        "description": "Percentage of male participants",
                        "multipleOf": 0.1,
                        "examples": [45.5, 52.3]
                      },
                      "female_percentage": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 100,
                        "description": "Percentage of female participants",
                        "multipleOf": 0.1,
                        "examples": [54.5, 47.7]
                      },
                      "diverse_population": {
                        "type": "boolean",
                        "description": "Whether the study included diverse ethnic populations",
                        "default": true
                      }
                    }
                  }
                }
              },
              "adverse_events": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "event_name": { 
                      "type": "string",
                      "pattern": "^[A-Za-z\\s]+$"
                    },
                    "severity": { 
                      "type": "integer",
                      "enum": [1, 2, 3, 4, 5],
                      "description": "Severity scale: 1=Mild, 2=Moderate, 3=Severe, 4=Life-threatening, 5=Death"
                    },
                    "frequency_percent": {
                      "type": "number",
                      "minimum": 0,
                      "maximum": 100
                    },
                    "reported_date": {
                      "type": "string",
                      "format": "date"
                    },
                    "resolved": {
                      "type": "boolean"
                    },
                    "medication_ref": {
                      "type": "string",
                      "$ref": "#/definitions/medication",
                      "$comment": "Reference to medication that caused the event"
                    }
                  }
                }
              }
            }
          },
          "manufacturing": {
            "type": "object",
            "properties": {
              "batch_number": {
                "type": "string",
                "pattern": "^[A-Z]{3}[0-9]{6}$",
                "description": "Format: XXX000000",
                "examples": ["ABC123456", "XYZ789012"]
              },
              "production_date": {
                "type": "string",
                "format": "date"
              },
              "production_time": {
                "type": "string",
                "format": "time",
                "description": "Start time of production run"
              },
              "temperature_celsius": {
                "type": "number",
                "description": "Storage temperature",
                "minimum": -80,
                "maximum": 40
              },
              "humidity_percent": {
                "type": "number",
                "minimum": 0,
                "maximum": 100
              },
              "sterile": {
                "type": "boolean",
                "default": true
              },
              "quality_checks": {
                "type": "object",
                "properties": {
                  "passed_all": {
                    "type": "boolean"
                  },
                  "check_date": {
                    "type": "string",
                    "format": "date"
                  },
                  "inspector_id": {
                    "type": "integer",
                    "readOnly": true,
                    "description": "System-assigned inspector ID",
                    "x-pennsieve-sensitive": true
                  },
                  "measurements": {
                    "type": "object",
                    "properties": {
                      "weight_grams": {
                        "type": "number",
                        "multipleOf": 0.001,
                        "minimum": 0.001,
                        "maximum": 1000,
                        "description": "Product weight in grams",
                        "examples": [125.5, 250.0]
                      },
                      "volume_ml": {
                        "type": "number",
                        "multipleOf": 0.1,
                        "minimum": 0.1,
                        "maximum": 5000,
                        "description": "Product volume in milliliters",
                        "default": 100.0
                      },
                      "purity_percent": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 100,
                        "multipleOf": 0.01
                      }
                    }
                  }
                }
              }
            }
          },
          "availability": {
            "type": "object",
            "properties": {
              "in_stock": {
                "type": "boolean"
              },
              "quantity": {
                "type": "integer",
                "minimum": 0
              },
              "reorder_point": {
                "type": "integer",
                "minimum": 0
              },
              "last_restocked": {
                "type": "string",
                "format": "date-time"
              },
              "discontinued": {
                "type": "boolean",
                "default": false,
                "deprecated": true,
                "description": "Use availability_status instead"
              },
              "available_countries": {
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": ["US", "CA", "UK", "EU", "JP", "AU"]
                },
                "minItems": 1,
                "uniqueItems": true,
                "default": ["US"]
              }
            }
          },
          "notes": {
            "type": ["string", "null"],
            "description": "Additional notes"
          },
          "api_config": {
            "type": "object",
            "description": "API configuration with advanced features",
            "additionalProperties": true,
            "minProperties": 2,
            "maxProperties": 10,
            "properties": {
              "endpoint": {
                "type": "string",
                "format": "uri",
                "const": "https://api.example.com/v1"
              },
              "auth_token": {
                "type": "string",
                "writeOnly": true,
                "contentMediaType": "application/jwt",
                "contentEncoding": "base64"
              }
            }
          }
        }
      },
      "created_at": "2025-07-18T16:01:08.852253Z",
      "model_template_id": null,
      "model_template_version": null
    }
  }

  // Create a minimal empty model for new model creation
  const emptyModel = {
    "id": "",
    "name": "",
    "display_name": "",
    "description": "",
    "created_at": new Date().toISOString(),
    "latest_version": {
      "version": 1,
      "schema": {
        "type": "object",
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "properties": {}
      },
      "created_at": new Date().toISOString(),
      "model_template_id": null,
      "model_template_version": null
    }
  }

  /**
   * Computed model data based on props, model state, and version selection
   */
  const modelData = computed(() => {
    // If a model prop is provided (from ModelSpecGenerator), use that
    if (props.model) {
      return {
        ...props.model,
        // Ensure latest_version structure is correct
        latest_version: props.model.latest_version || {
          version: 1,
          schema: props.model.schema || { ...defaultSchema }
        }
      }
    }
    
    // If no modelId is provided, we're creating a new model
    if (!props.modelId) {
      return {
        ...emptyModel,
        name: props.previewName || '',
        display_name: props.previewDisplayName || '',
        description: props.previewDescription || ''
      }
    }
    
    // If we have a specific version loaded, use that
    if (currentVersionData.value && selectedVersion.value !== 'latest') {
      return {
        ...model.value,
        latest_version: currentVersionData.value
      }
    }
    
    // Otherwise use the model's latest version
    return model.value || testModel
  })

  /**
   * Schema for JSON view - always use the modelData's latest_version schema
   */
  const displaySchema = computed(() => {
    // Always use the modelData's latest_version schema for consistency
    // This ensures the JSON view shows the same data as the UI view
    return modelData.value?.latest_version?.schema || {
      "type": "object",
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "properties": {}
    }
  })

  return {
    // Constants
    defaultSchema,
    testModel,
    emptyModel,
    
    // Computed data
    modelData,
    displaySchema
  }
}