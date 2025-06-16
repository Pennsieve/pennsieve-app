import {ModelRecordsComponentInstance, Model, ModelRecord, ModelRecordsRoute} from "./_model";
import {useGetToken} from "../../../composables/useGetToken.js"
import {useHandleXhrError} from "../../../mixins/request/request_composable"

/**
 * execute the fetch of records from the concept instances endpoint
 */
const fetchRecords = async (instance: ModelRecordsComponentInstance): Promise<void> => {

  if (!instance.modelRecordsUrl) return Promise.resolve()

  instance.resultsLoading = true
  instance.searchResults = []

  console.log('FETCH')
  
  try {
    useGetToken()
        .then(async token => {
          console.log(token)

          
          instance.searchResults = await instance.sendXhr<ModelRecord[]>(instance.modelRecordsUrl, {
            header: {
              'Authorization': `bearer ${token}`
            },
            method: 'GET',
          })
        })
        .catch(useHandleXhrError)
        .finally(() => instance.resultsLoading = false)



  } catch (err) {
    instance.resultsLoading = false
    console.log(err)
    // instance.logger(['Error', err.statusText ?? err], 'error')
  }

}

/**
 * call back when a column is sorted
 */
const onUpdateSort = (instance: ModelRecordsComponentInstance, sortBy: string): void => {
  if (instance.sortBy === sortBy) {
    instance.sortDirection = instance.sortDirection === 'asc' ? 'desc' : 'asc'
  } else {
    instance.sortBy = sortBy || 'createdAt'
  }
  instance.offset = 0
  instance.fetchRecords()
}

/**
 * callback when the records per page is changed
 */
const onUpdateLimit = (instance: ModelRecordsComponentInstance, limit: number): void => {
  instance.offset = 0;
  instance.limit = limit;
  instance.fetchRecords();
}

/**
 * callback for when the page number is changed
 */
const onPaginationPageChange = (instance: ModelRecordsComponentInstance, page: number): void =>{
  instance.offset = (page - 1) * instance.limit
  instance.fetchRecords()
}

/**
 * single object to expose the method helpers
 */
export const Methods = {
  fetchRecords,
  onUpdateSort,
  onUpdateLimit,
  onPaginationPageChange
}
