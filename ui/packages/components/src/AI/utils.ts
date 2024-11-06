export type OpenAIOutput = {
  model: string;
  experimental_providerMetadata?: never;
} & Object;

export type VercelAIOutput = {
  experimental_providerMetadata: unknown;
  model?: never;
} & Object;

export type ExperimentalAI = OpenAIOutput | VercelAIOutput;

export const parseAIOutput = (output: string): ExperimentalAI | undefined => {
  try {
    const data: ExperimentalAI = JSON.parse(output);

    //
    // a temporary hack to detect ai output until first class
    // step.ai indicators are added
    if (data.model || data.experimental_providerMetadata) {
      return data;
    }
    return undefined;
  } catch (e) {
    console.warn('Unable to parse step ai output as JSON');
    return undefined;
  }
};

//
// regex pattern to match the key pieces of ai information in outputs:
// promptTokens, completionTokens, totalTokens, model and common variations
// such as promptTokens, prompt_tokens, modelId, model, etc.
const pattern = /\b(?:prompt|completion|total|model|modelId)[ _]?(?:tokens?|model|modelId)?\b/i;

type Value = string | number | boolean | null;
type Object = { [key: string]: Value | Object | Array<Value | Object> };

type ResultType = {
  promptTokens?: Value;
  completionTokens?: Value;
  totalTokens?: Value;
  model?: Value;
};

/*
 * recursively search through the object to find any of the key pieces of ai information
 * we care about. For now just take the first match we find for each and stop there.
 */
export const getAIInfo = (obj: Object): ResultType => {
  return Object.keys(obj).reduce<ResultType>((acc, key) => {
    if (acc.promptTokens && acc.completionTokens && acc.totalTokens && acc.model) {
      return acc;
    }

    const value = obj[key];

    //
    // Handle arrays by reducing each element into a combined result
    if (Array.isArray(value)) {
      const arrayResult = value.reduce<ResultType>((arrayAcc, item) => {
        if (typeof item === 'object' && item !== null) {
          return { ...arrayAcc, ...getAIInfo(item) };
        }
        return arrayAcc;
      }, {});
      return { ...acc, ...arrayResult };
    }

    if (typeof value === 'object' && value !== null) {
      return { ...acc, ...getAIInfo(value) };
    }

    const match = pattern.exec(key);

    if (match) {
      if (!acc.promptTokens && /prompt/.test(key)) {
        acc.promptTokens = value;
      } else if (!acc.completionTokens && /completion/.test(key)) {
        acc.completionTokens = value;
      } else if (!acc.totalTokens && /total/.test(key)) {
        acc.totalTokens = value;
      } else if (!acc.model && /model/.test(key)) {
        acc.model = value;
      }
    }

    return acc;
  }, {});
};
