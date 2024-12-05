
interface LinkedProperty {
    linkedPropertyId: string;
    schemaLinkedProperty: {
        displayName: string;
        id: string;
        name: string;
    };
    to: {
        modelDisplayName: string;
        modelId: string;
        recordDisplayName: string;
        recordId: string;
    }
}

interface ConceptInstanceRoute {
    readonly params: {
        readonly datasetId?: string;
        readonly instanceId?: string;
    }
}

type AddLinkedPropertyComponentInstance = {
    $route: ConceptInstanceRoute
    radioSelection: string;
    initialSelection: string;
    linkedProperty: Partial<LinkedProperty>;
    isCreating: boolean;
    visible: boolean;
    recordTo: Partial<ModelRecord>
} & Omit<ModelRecordsComponentInstance, '$route' | 'isFilesProxy' | 'concepts'>

interface EntityMetaData {
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
}

interface Model extends EntityMetaData {
    id: string;
    count: number;
    locked: boolean;
    name: string;
    displayName: string;
    description: string;
    propertyCount: number;
    templateId: string | null;
}

type ValueSingleType = string | number | boolean
type ValueArrayType = string[] | number[] | boolean[]
type ValueType = null | ValueSingleType | ValueArrayType

interface PropertyInstance {
    conceptTitle: boolean;
    dataType: any; // @todo bring back data-type.ts model
    default: boolean;
    displayName: string;
    locked: boolean;
    name: string;
    required: boolean;
    value: ValueType
}

interface ModelRecord extends EntityMetaData {
    id: string;
    type: string;
    values: PropertyInstance[]
}

interface ModelRecordsRoute {
    readonly params: {
        readonly datasetId?: string;
        readonly conceptId?: string;
    }
}

interface ModelRecordsComponentInstance {
    config: { conceptsUrl: string };
    datasetId: string;
    conceptId: string;
    userToken: string | undefined;
    isFilesProxy: boolean;
    concepts: Model[];
    concept: Partial<Model>;
    modelRecordsUrl: string | undefined;
    limit: number;
    offset: number;
    sortDirection: 'asc' | 'desc';
    sortBy: string;
    prefixField: (input: string, encode: boolean) => string;
    resultsLoading: boolean;
    searchResults: ModelRecord[];
    totalResults: number;
    sendXhr: <T>(url: string, opts: object) => Promise<T>;
    logger: (...args: any) => void;
    fetchRecords: () => void;
}

/**
 * legacy functionality - not sure if this is still relevant
 */
const getConceptTitle = (records: ModelRecord[]): Partial<PropertyInstance> => {
    const [head = { values: [] }, ...tail] = records
    return head.values.find(v => v.conceptTitle) ?? {}
}

/**
 * callback when the select all checkbox is selected
 * @param originalSelectedItemIds the original set
 * @param items
 * @param records
 * @return IMPORTANT - return a NEW set with the mutated values
 */
const onSelectAllItems = (originalSelectedItemIds: Set<string>, items: { recordId: string }[], records: ModelRecord[]): Set<string> => {
    const newSelectedItemIds = new Set(originalSelectedItemIds)
    if (items.length) {
        items.forEach(item => newSelectedItemIds.add(item.recordId))
    } else {
        records.forEach(({ id }) => newSelectedItemIds.delete(id))
    }
    return newSelectedItemIds
}

/**
 * callback when the a single checkbox is selected
 * @param originalSelectedItemIds the original set
 * @return IMPORTANT - return a NEW set with the mutated values
 */
const onSelectIndividualItem = (originalSelectedItemIds: Set<string>, value: boolean, item: { recordId: string }): Set<string> => {
    const newSelectedItemIds = new Set(originalSelectedItemIds)
    if (value) {
        newSelectedItemIds.add(item.recordId)
    } else {
        newSelectedItemIds.delete(item.recordId)
    }
    return newSelectedItemIds
}

export function useConcepts() {

    return {
        getConceptTitle,
        onSelectAllItems,
        onSelectIndividualItem
    }
}

