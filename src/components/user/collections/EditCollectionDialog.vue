<template>
  <div>
    <el-dialog
      v-model="dialogVisible"
      title="Edit Collection"
      class="edit-collections-dialog"
      :show-close="false"
      @close="closeDialog"
    >
      <div class="bf-dialog-body">
        <el-form ref="formRef" :model="form" label-width="130px">
          <!-- Collection Name -->
          <el-form-item label="Collection Name" required>
            <el-input v-model="form.name" placeholder="Enter collection name" />
          </el-form-item>

          <!-- Collection Description -->
          <el-form-item label="Description" required>
            <el-input
              v-model="form.description"
              type="textarea"
              placeholder="Enter description"
            />
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <div class="delete-collection">
            <!-- <bf-button class="red" @click="deleteCollection()">Delete</bf-button> -->
          </div>
          <bf-button class="secondary" @click="closeDialog" >Cancel</bf-button>
          <bf-button class="edit-collection-button" type="primary" :loading="isLoading" @click="submit">
            Save
          </bf-button>
        </div>
      </template>
    </el-dialog>

  </div>
  </template>
  
  <script setup>
  import { ref, defineProps, defineEmits, watch } from "vue";
  import { ElMessage } from "element-plus";
  import BfButton from "@/components/shared/bf-button/BfButton.vue";
  import { useCollectionsStore } from "@/stores/collectionStore.js"
  import { useRouter} from "vue-router"

  const props = defineProps({
    collectionDetails: {
      type: Object,
      required: true,
    },
  });
  const emit = defineEmits(["close", "collectionUpdated"]);

  const router = useRouter();
  const collectionStore = useCollectionsStore();
  const dialogVisible = ref(true)
  const isLoading = ref(false);
  const form = ref({
    name: "",
    description: "",
  });
  
  watch(
    () => props.collectionDetails,
    (newVal) => {
        if (newVal) {
        form.value.name = newVal.name || "";
        form.value.description = newVal.description || "";
        }
    },
    { immediate: true }
    );

  const closeDialog = () => {
    dialogVisible.value = false;
    emit("close",true);
  };
  
  /**
   * call to edit a collection
   * collections BE
   */
  async function editCollection() {
    if (!form.value.name.trim()) {
      ElMessage.error("Collection name is required");
      return;
    }
    if (!form.value.description.trim()) {
      ElMessage.error("Collection description is required");
      return;
    }
    isLoading.value = true

    try{
      const response = await collectionStore.editCollection(props.collectionDetails.id,form.value);
      ElMessage.success(`Successfully updated collection: ${response.name}`);
      
      // Emit the updated collection data
      emit("collectionUpdated", response);
  
    }catch(error){
      console.log(error)
      ElMessage.error("Failed to update collection");
    }finally{
      isLoading.value = false;
      closeDialog();
    }
  };

  /*
  Delete Collection
  */
//   async function deleteCollection() {
//    if(!confirm("Are you sure you want to perminately delete this collection?")){return}
//     try{
//       await collectionStore.deleteCollection(props.collectionDetails.id);
//       collectionStore.clearCollectionsStore();
//       ElMessage.success(`perminately deleted collection ${props.collectionDetails.id}`)
//       router.push('/workspaces/user/collections/my-collections');
//     }catch(error){
//       ElMessage.error("failed to delete collection")
//       closeDialog()
//     }
// }

  /**
   * Handles form submission
   */
  const submit = async () => {
    if (!form.value.name.trim()) {
      ElMessage.error("Collection name is required");
      return;
    }
    if (!form.value.description.trim()) {
      ElMessage.error("Collection description is required");
      return;
    }
    editCollection();
  
  };
  </script>
  
  <style scoped lang="scss">
  @use '../../../styles/_theme.scss';
  @use '../../../styles/element/dialog';

  .edit-collection-button{
    background: #011F5B;
    border: none;
  }
  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
  .delete-collection{
    margin-right: auto;
  }
  </style>
  