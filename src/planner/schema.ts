import { SchemaType } from '@google/generative-ai'

/**
 * JSON Schema for TestPlan passed to Gemini's responseSchema config.
 * Forces the model to return schema-conformant JSON — no markdown fences,
 * no prose, no hallucinated keys.
 */
export const TEST_PLAN_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    scenarioName: {
      type: SchemaType.STRING,
      description: 'Name of the BDD scenario',
    },
    url: {
      type: SchemaType.STRING,
      description: 'The starting URL for the test',
    },
    actions: {
      type: SchemaType.ARRAY,
      description: 'Ordered list of test actions to execute',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          action: {
            type: SchemaType.STRING,
            enum: ['navigate', 'fill', 'click', 'assert_visible', 'assert_text', 'assert_url', 'wait'],
            description: 'The type of action to perform',
          },
          selector: {
            type: SchemaType.STRING,
            description: 'CSS selector for the target element',
          },
          value: {
            type: SchemaType.STRING,
            description: 'Value to fill, text to assert, or URL to navigate to',
          },
          description: {
            type: SchemaType.STRING,
            description: 'Human-readable description of this step',
          },
        },
        required: ['action', 'description'],
      },
    },
  },
  required: ['scenarioName', 'url', 'actions'],
}
