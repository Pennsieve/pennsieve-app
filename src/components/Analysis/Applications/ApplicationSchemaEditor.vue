<template>
  <div class="application-schema-editor">
    <!-- ───────────── About: tags ───────────── -->
    <template v-if="part === 'tags'">
      <div class="field-row" data-field="application.tags" :class="{ 'has-problem': at('application.tags').length }">
        <label class="field-label">Tags <field-hint text="What the app is for; it colours its card and helps people find it." /></label>
        <div class="field-control">
          <domain-tags-input :model-value="schema.tags" colours @update:model-value="setTags">
            <p v-for="m in at('application.tags')" :key="m" class="field-error">{{ m }}</p>
          </domain-tags-input>
        </div>
      </div>
    </template>

    <!-- ───────────── What it does: inputs, parameters, outputs ───────────── -->
    <template v-else-if="part === 'io'">
      <template v-for="block in ioBlocks" :key="block.key">
        <!-- Parameters, between what goes in and what comes out -->
        <div v-if="block.key === 'parameters'" class="sub-section">
          <h5 class="sub-section-title">
            Parameters <span class="label-helper">optional</span>
            <field-hint text="Settings people choose when they run the app; defaults fill them in." />
          </h5>

          <div
            v-for="(param, index) in schema.parameters"
            :key="`p${index}`"
            class="param-card"
            :data-field="`parameters.${index}`"
          >
            <div class="card-head">
              <span class="card-title">{{ param.name || `Parameter ${index + 1}` }}</span>
              <button type="button" class="app-outline-button" @click="removeParameter(index)">Remove</button>
            </div>
            <div class="param-card-grid">
              <div class="field-row" :data-field="`parameters.${index}.name`" :class="rowClass(`parameters.${index}.name`)">
                <label class="field-label">Name</label>
                <div class="field-control">
                  <el-input
                    :model-value="param.name"
                   
                    placeholder="parameter"
                    maxlength="50"
                    @input="(v) => onParamNameInput(param, v)"
                  />
                  <p v-for="m in at(`parameters.${index}.name`)" :key="m" class="field-error">{{ m }}</p>
                </div>
              </div>

              <div class="field-row" :data-field="`parameters.${index}.type`" :class="rowClass(`parameters.${index}.type`)">
                <label class="field-label">Type</label>
                <div class="field-control">
                  <el-select :model-value="param.type" class="full" @change="(v) => onParamTypeChange(param, v)">
                    <el-option v-for="t in PARAM_TYPE_OPTIONS" :key="t.value" :label="t.label" :value="t.value" />
                  </el-select>
                  <p v-for="m in at(`parameters.${index}.type`)" :key="m" class="field-error">{{ m }}</p>
                </div>
              </div>

              <div class="field-row">
                <label class="field-label">Required</label>
                <div class="field-control">
                  <el-switch v-model="param.required" />
                </div>
              </div>

              <!-- Valid values (enum) -->
              <div
                v-if="param.type === PARAM_TYPES.ENUM"
                class="field-row"
                :data-field="`parameters.${index}.validValues`"
                :class="rowClass(`parameters.${index}.validValues`)"
              >
                <label class="field-label">Valid values</label>
                <div class="field-control">
                  <el-select
                    v-model="param.validValues"
                   
                    multiple
                    filterable
                    allow-create
                    default-first-option
                    :reserve-keyword="false"
                    placeholder="Type a value and press Enter"
                    class="full"
                  />
                  <p v-for="m in at(`parameters.${index}.validValues`)" :key="m" class="field-error">{{ m }}</p>
                </div>
              </div>

              <!-- Default value: control depends on type -->
              <div class="field-row" :data-field="`parameters.${index}.defaultValue`" :class="rowClass(`parameters.${index}.defaultValue`)">
                <label class="field-label">Default</label>
                <div class="field-control">
                  <el-switch v-if="param.type === PARAM_TYPES.BOOLEAN" v-model="param.defaultValue" />
                  <el-input
                    v-else-if="isNumericType(param.type)"
                    v-model="param.defaultValue"
                   
                    type="number"
                    placeholder="No default"
                  />
                  <el-select
                    v-else-if="param.type === PARAM_TYPES.ENUM"
                    v-model="param.defaultValue"
                   
                    clearable
                    placeholder="No default"
                    class="full"
                  >
                    <el-option v-for="v in param.validValues" :key="v" :label="v" :value="v" />
                  </el-select>
                  <el-input v-else v-model="param.defaultValue" placeholder="No default" />
                  <p v-for="m in at(`parameters.${index}.defaultValue`)" :key="m" class="field-error">{{ m }}</p>
                </div>
              </div>

              <div class="field-row full-width" :data-field="`parameters.${index}.description`">
                <label class="field-label">Description</label>
                <div class="field-control">
                  <el-input v-model="param.description" placeholder="What does this parameter control? (optional)" />
                </div>
              </div>

              <!-- Min / Max (number), the advanced part -->
              <more-options
                v-if="isNumericType(param.type)"
                :force-open="hasValue(param.min) || hasValue(param.max) || !!at(`parameters.${index}.min`).length || !!at(`parameters.${index}.max`).length"
              >
                <div class="field-row" :data-field="`parameters.${index}.min`" :class="rowClass(`parameters.${index}.min`)">
                  <label class="field-label">Min</label>
                  <div class="field-control">
                    <el-input v-model="param.min" type="number" placeholder="optional" />
                    <p v-for="m in at(`parameters.${index}.min`)" :key="m" class="field-error">{{ m }}</p>
                  </div>
                </div>
                <div class="field-row" :data-field="`parameters.${index}.max`" :class="rowClass(`parameters.${index}.max`)">
                  <label class="field-label">Max</label>
                  <div class="field-control">
                    <el-input v-model="param.max" type="number" placeholder="optional" />
                    <p v-for="m in at(`parameters.${index}.max`)" :key="m" class="field-error">{{ m }}</p>
                  </div>
                </div>
              </more-options>
            </div>
          </div>

          <button type="button" class="app-outline-button add-row" @click="addParameter">+ Add parameter</button>
        </div>

        <!-- Inputs / Outputs -->
        <div v-else class="sub-section">
          <h5 class="sub-section-title">
            {{ block.label }} <span class="label-helper">optional</span>
            <field-hint :text="block.hint" />
          </h5>

          <div
            v-for="(port, index) in schema[block.key]"
            :key="`${block.key}${index}`"
            class="param-card"
            :data-field="`${block.key}.${index}`"
            :class="{ 'has-problem': at(`${block.key}.${index}`).length }"
          >
            <div class="card-head">
              <span class="card-title">{{ port.name || `${block.singular} ${index + 1}` }}</span>
              <button type="button" class="app-outline-button" @click="removePort(block.key, index)">Remove</button>
            </div>
            <p v-for="m in at(`${block.key}.${index}`)" :key="m" class="field-error">{{ m }}</p>
            <div class="param-card-grid">
              <!-- Name first: the card is about "study", not "input 1" -->
              <div class="field-row full-width" :data-field="`${block.key}.${index}.name`" :class="rowClass(`${block.key}.${index}.name`)">
                <label class="field-label">Name</label>
                <div class="field-control">
                  <el-input v-model="port.name" :placeholder="portMode(port) === 'layout' ? 'study' : 'recordings'" maxlength="50" />
                  <p class="field-hint">An identifier, e.g. <code>study</code> (lowercase, no spaces).</p>
                  <p v-for="m in at(`${block.key}.${index}.name`)" :key="m" class="field-error">{{ m }}</p>
                </div>
              </div>

              <!--
                What the input is made of at its root: files, folders of a
                folder format (OME-Zarr), or one folder with a set layout (BIDS).
              -->
              <div class="field-row full-width">
                <label class="field-label">{{ block.key === "inputs" ? "It takes" : "It writes" }}</label>
                <div class="field-control">
                  <el-radio-group :model-value="portMode(port)" size="small" :aria-label="`What the ${block.singular} is made of`" @update:model-value="(v) => setPortMode(port, v)">
                    <el-radio-button v-for="m in portModes(block.key)" :key="m.value" :value="m.value">{{ m.label }}</el-radio-button>
                  </el-radio-group>
                  <p class="field-hint">{{ PORT_MODES.find((m) => m.value === portMode(port)).hint }}</p>
                </div>
              </div>

              <!--
                Reference data: a folder whose contents are described in public
                identifiers. Pennsieve's catalog can fill in the description
                (and the folder, at run time); the author can also write it.
              -->
              <template v-if="portMode(port) === 'reference'">
                <div v-if="hasReferenceCatalog" class="field-row full-width">
                  <label class="field-label">Default reference</label>
                  <div class="field-control">
                    <p v-if="referenceCatalogState === 'failed'" class="field-error">Pennsieve's reference data couldn't be loaded; describe the reference below.</p>
                    <el-select
                      v-else
                      :model-value="referenceEntryOf(port)?.id || ''"
                      class="full"
                      filterable
                      clearable
                      :loading="referenceCatalogState === 'loading'"
                      :placeholder="port.reference ? 'Not in Pennsieve\'s reference data (described below)' : 'Choose from Pennsieve\'s reference data'"
                      @change="(id) => pickReference(port, id)"
                    >
                      <el-option-group v-for="g in referenceGroups" :key="g.kind" :label="g.label">
                        <el-option v-for="e in g.entries" :key="e.id" :label="referenceLabel(e)" :value="e.id">
                          <span>{{ referenceLabel(e) }}</span>
                          <span class="reference-option-meta">{{ assetClassName(e.version?.spec?.assetClass) }}</span>
                        </el-option>
                      </el-option-group>
                    </el-select>
                    <p class="field-hint">
                      Fills in the description from
                      <router-link :to="{ name: 'reference-catalog' }" target="_blank">Pennsieve's reference data</router-link>.
                      <button type="button" class="link-button" @click="toggleDescription(port)">
                        {{ showsDescription(port) ? "Hide the description" : "Not there? Describe it" }}
                      </button>
                    </p>
                    <p v-if="referenceRestriction(port.reference)" class="field-hint">
                      {{ referenceRestriction(port.reference) }} Choosing a reference here lets runs pick any.
                    </p>
                  </div>
                </div>

                <div v-if="showsDescription(port)" class="field-row full-width reference-description">
                  <label class="field-label">What the folder holds</label>
                  <div class="field-control">
                    <div class="reference-grid">
                      <span class="reference-grid-label">Kind</span>
                      <el-radio-group :model-value="port.reference?.kind || 'genome'" size="small" aria-label="Kind of reference" @update:model-value="(k) => setReferenceKind(port, k)">
                        <el-radio-button value="genome">Genome asset</el-radio-button>
                        <el-radio-button value="template">Template or atlas</el-radio-button>
                      </el-radio-group>

                      <span class="reference-grid-label">What it is</span>
                      <div>
                        <el-select
                          :model-value="port.reference?.assetClass || ''"
                          class="full"
                          filterable
                          allow-create
                          default-first-option
                          :placeholder="(port.reference?.kind || 'genome') === 'template' ? 'e.g. brain-template' : 'e.g. salmon-index, star-index, fasta'"
                          @change="(v) => setReferenceField(port, 'assetClass', identifierFrom(v))"
                        >
                          <el-option v-for="c in assetClassOptions(port)" :key="c" :label="assetClassName(c) === c ? c : `${assetClassName(c)} (${c})`" :value="c" />
                        </el-select>
                        <p v-for="m in at(`inputs.${index}.reference.assetClass`)" :key="m" class="field-error">{{ m }}</p>
                      </div>

                      <template v-if="(port.reference?.kind || 'genome') === 'genome'">
                        <span class="reference-grid-label">Tool versions</span>
                        <div>
                          <el-input :model-value="port.reference?.toolVersion || ''" placeholder="For an index, e.g. >=2 <3 (optional)" @update:model-value="(v) => setReferenceField(port, 'toolVersion', v)" />
                          <p v-for="m in at(`inputs.${index}.reference.toolVersion`)" :key="m" class="field-error">{{ m }}</p>
                        </div>

                        <span class="reference-grid-label">Organism</span>
                        <div>
                          <el-select
                            :model-value="referenceIdentity(port).taxonomyId || ''"
                            class="full"
                            filterable
                            remote
                            clearable
                            :remote-method="searchOrganisms"
                            :loading="organismSearching"
                            @visible-change="(open) => open || searchOrganisms('')"
                            placeholder="Search species, e.g. zebrafish or Danio rerio"
                            @change="(v) => setIdentityField(port, 'taxonomyId', v)"
                          >
                            <el-option v-for="o in organismOptions(port)" :key="o.taxonomyId" :label="o.label" :value="o.taxonomyId">
                              <span>{{ o.label }}</span>
                              <span class="reference-option-meta">{{ o.common || `NCBITaxon:${o.taxonomyId}` }}</span>
                            </el-option>
                          </el-select>
                          <p v-for="m in identityProblems(port, index, 'taxonomyId')" :key="m" class="field-error">{{ m }}</p>
                        </div>

                        <span class="reference-grid-label">Assembly</span>
                        <div>
                          <el-input :model-value="referenceIdentity(port).assembly || ''" placeholder="Accession, e.g. GCA_000001405.29 (GRCh38)" @update:model-value="(v) => setIdentityField(port, 'assembly', v)" />
                          <p v-for="m in identityProblems(port, index, 'assembly')" :key="m" class="field-error">{{ m }}</p>
                        </div>

                        <span class="reference-grid-label">Annotation</span>
                        <div class="reference-pair">
                          <el-input :model-value="referenceIdentity(port).annotation?.provider || ''" placeholder="Provider, e.g. GENCODE" @update:model-value="(v) => setAnnotation(port, 'provider', v)" />
                          <el-input :model-value="referenceIdentity(port).annotation?.version || ''" placeholder="Release, e.g. 50" @update:model-value="(v) => setAnnotation(port, 'version', v)" />
                        </div>
                      </template>

                      <template v-else>
                        <span class="reference-grid-label">Properties</span>
                        <div>
                          <div v-for="(row, i) in propertyRows(port)" :key="i" class="reference-pair">
                            <el-input :model-value="row.name" placeholder="Name, e.g. space" @update:model-value="(v) => setPropertyRow(port, i, { name: v })" />
                            <el-input :model-value="row.value" placeholder="Value, e.g. MNI152NLin2009cAsym" @update:model-value="(v) => setPropertyRow(port, i, { value: v })" />
                            <button type="button" class="link-button" @click="removePropertyRow(port, i)">Remove</button>
                          </div>
                          <button type="button" class="link-button" @click="addPropertyRow(port)">+ Add a property</button>
                          <p class="field-hint">What identifies it, e.g. TemplateFlow's space, resolution and desc.</p>
                        </div>
                      </template>
                    </div>
                    <p v-for="m in at(`inputs.${index}.reference`)" :key="m" class="field-error">{{ m }}</p>
                  </div>
                </div>

                <p class="field-hint reference-summary">
                  The folder <code>$INPUT_DIR/{{ port.name || "&lt;name&gt;" }}/</code> holds this reference. On Pennsieve it's filled from reference data when there's a match, and runs may pick another of the same kind; otherwise a run takes the files, as it does anywhere else.
                </p>
              </template>
              <!-- A file or a folder: its format -->
              <div v-if="portMode(port) === 'file' || portMode(port) === 'folder'" class="field-row full-width" :data-field="`${block.key}.${index}.mediaTypes`" :class="{ 'has-problem': formatProblems(port, `${block.key}.${index}.mediaTypes`).length > 0 }">
                <label class="field-label">{{ portMode(port) === "folder" ? "Folder formats" : "Media types" }}</label>
                <div class="field-control">
                  <!-- Searchable by format name, extension or media type; any number of them -->
                  <el-select
                    :model-value="portTypes(port)"
                    class="full"
                    multiple
                    filterable
                    :filter-method="(q) => (mediaTypeQuery = q)"
                    :placeholder="portMode(port) === 'folder' ? 'e.g. OME-Zarr, MEF3' : 'Any file. Search formats, e.g. NWB, .edf'"
                    @visible-change="(open) => open || ((mediaTypeQuery = ''), formatTouched.add(toRaw(port)))"
                    @change="(v) => onPortMediaTypesChange(port, v)"
                  >
                    <el-option
                      v-for="dt in formatChoices(port).filter((o) => o.value !== 'any' && mediaTypeMatches(o, mediaTypeQuery))"
                      :key="dt.value"
                      :label="dt.formats && dt.formats.length ? `${dt.formats.join(' / ')} (${dt.value})` : dt.label"
                      :value="dt.value"
                    >
                      <span class="mt-option">
                        <span class="mt-name">{{ dt.formats && dt.formats.length ? dt.formats.join(" / ") : dt.label }}</span>
                        <span v-if="dt.formats && dt.formats.length" class="mt-meta">
                          {{ dt.value }}<template v-if="portMode(port) === 'folder' && dt.folderExtensions && dt.folderExtensions.length"> · {{ dt.folderExtensions.map((e) => `*${e}/`).join(", ") }}</template><template v-else-if="dt.extensions && dt.extensions.length"> · {{ dt.extensions.join(", ") }}</template>
                        </span>
                      </span>
                    </el-option>
                  </el-select>
                  <!-- A folder format picked as files: say what the app gets -->
                  <p v-if="portMode(port) === 'file' && folderFormatOf(port)" class="field-hint">
                    {{ folderFormatOf(port).formats?.[0] || folderFormatOf(port).value }} is a folder format. As files, the app
                    {{ block.key === "inputs" ? "gets" : "writes" }} each one as stored<template v-if="folderFormatOf(port).extensions?.length"> ({{ folderFormatOf(port).extensions.join(", ") }})</template>.
                    <button type="button" class="link-button" @click="setPortMode(port, 'folder')">Use folders<template v-if="folderFormatOf(port).folderExtensions?.length"> ({{ folderFormatOf(port).folderExtensions.map((e) => `*${e}/`).join(", ") }})</template> instead</button>
                  </p>
                  <p v-for="m in formatProblems(port, `${block.key}.${index}.mediaTypes`)" :key="m" class="field-error">{{ m }}</p>
                </div>
              </div>

              <!-- One folder with a set layout -->
              <template v-if="portMode(port) === 'layout'">
                <div class="field-row full-width" :data-field="`${block.key}.${index}.conformsTo`">
                  <label class="field-label">Layout</label>
                  <div class="field-control">
                    <!-- A link from app.yml is kept, shown as is; the builder offers registry layouts -->
                    <span v-if="isStructureLink(port.conformsTo[0])" class="field-static">
                      {{ port.conformsTo[0] }} <span class="label-helper">(edit in app.yml)</span>
                    </span>
                    <el-select
                      v-else
                      :model-value="port.conformsTo[0] ? structureId(port.conformsTo[0]) : ''"
                      class="full"
                      filterable
                      :filter-method="(q) => (mediaTypeQuery = q)"
                      placeholder="e.g. BIDS, SPARC SDS"
                      fit-input-width
                      popper-class="described-options"
                      @visible-change="(open) => open || (mediaTypeQuery = '')"
                      @change="(v) => onLayoutChange(port, v)"
                    >
                      <el-option
                        v-for="s in structureOptions.filter((o) => structureMatches(o, mediaTypeQuery))"
                        :key="s.id"
                        :label="s.name"
                        :value="s.id"
                      >
                        <span class="mt-option">
                          <span class="mt-name">{{ s.name }}</span>
                          <span v-if="s.description" class="mt-meta mt-wrap" :title="s.description">{{ s.description }}</span>
                        </span>
                      </el-option>
                    </el-select>
                    <p v-if="port.conformsTo[0]" class="field-hint">
                      The folder {{ block.key === "inputs" ? "picked" : "written" }}, whatever its name, is the root of the {{ structureName(port.conformsTo[0]) }} layout<template v-if="layoutRootFile(port.conformsTo[0])"> ({{ layoutRootFile(port.conformsTo[0]) }} directly inside it)</template><template v-if="port.conformsTo[1]">, and {{ structureName(port.conformsTo[1]) }} starts at its {{ contentRootOf(port) }}/ folder</template>.
                    </p>
                  </div>
                </div>
                <!-- Nesting: a layout with a content root (files/) may hold another -->
                <div v-if="contentRootOf(port)" class="field-row full-width">
                  <label class="field-label">Its {{ contentRootOf(port) }}/ folder is laid out as</label>
                  <div class="field-control">
                    <el-select :model-value="port.conformsTo[1] ? structureId(port.conformsTo[1]) : ''" class="full" @change="(v) => onInnerStructure(port, v)">
                      <el-option label="No particular layout" value="" />
                      <el-option v-for="s in structureOptions.filter((o) => o.id !== structureId(port.conformsTo[0]))" :key="s.id" :label="s.name" :value="s.id" />
                    </el-select>
                  </div>
                </div>
                <div class="field-row full-width">
                  <label class="field-label">Files in it <span class="label-helper">optional</span></label>
                  <div class="field-control">
                    <el-select
                      :model-value="port.mediaTypes"
                      class="full"
                      multiple
                      filterable
                      :filter-method="(q) => (mediaTypeQuery = q)"
                      placeholder="Any files"
                      @visible-change="(open) => open || (mediaTypeQuery = '')"
                      @change="(v) => onContainsChange(port, v)"
                    >
                      <el-option
                        v-for="dt in portDataTypes.filter((o) => o.value !== 'any' && mediaTypeMatches(o, mediaTypeQuery))"
                        :key="dt.value"
                        :label="dt.formats && dt.formats.length ? dt.formats.join(' / ') : dt.label"
                        :value="dt.value"
                      />
                    </el-select>
                  </div>
                </div>
                <!-- Folder formats inside the layout: as folders (default) or as stored -->
                <div v-if="showsContainer(port)" class="field-row full-width">
                  <label class="field-label">Folder formats in it are {{ block.key === "inputs" ? "given" : "written" }} as</label>
                  <div class="field-control">
                    <el-select :model-value="containerChoice(port)" class="full" @change="(v) => onContainerChange(port, v)">
                      <el-option label="Folders, as the layout expects" value="directory" />
                      <el-option label="As stored (compressed)" value="file" />
                    </el-select>
                  </div>
                </div>
              </template>

              <div class="field-row full-width" :data-field="`${block.key}.${index}.description`">
                <label class="field-label">Description</label>
                <div class="field-control">
                  <el-input v-model="port.description" placeholder="What goes here (optional)" />
                </div>
              </div>
              <!-- Where the input's data goes in INPUT_DIR -->
              <!-- Where an output is written: the whole OUTPUT_DIR, or its own folder -->
              <div v-if="block.key === 'outputs'" class="field-row full-width">
                <label class="field-label">Written to</label>
                <div class="field-control">
                  <span class="field-static"><code>$OUTPUT_DIR/<template v-if="(schema.outputs || []).length > 1">{{ port.name || "&lt;name&gt;" }}/</template></code></span>
                  <p class="field-hint">
                    <template v-if="(schema.outputs || []).length > 1">With two or more outputs, each goes in its own folder, so a workflow can send each one to its own data target.</template>
                    <template v-else>With one output, it's the whole of OUTPUT_DIR.</template>
                  </p>
                </div>
              </div>
              <div v-if="block.key === 'inputs' && portMode(port) === 'reference'" class="field-row full-width">
                <label class="field-label">Placed at</label>
                <div class="field-control">
                  <span class="field-static"><code>$INPUT_DIR/{{ port.name || "&lt;name&gt;" }}/</code></span>
                  <p class="field-hint">A reference is unpacked into the input's own folder.</p>
                </div>
              </div>
              <div v-else-if="block.key === 'inputs'" class="field-row full-width">
                <label class="field-label">Placed at</label>
                <div class="field-control">
                  <el-radio-group :model-value="port.placement || 'root'" size="small" aria-label="Where the input is placed" @update:model-value="(v) => (port.placement = v === 'root' ? '' : v)">
                    <el-radio-button v-for="pl in PLACEMENTS" :key="pl.value" :value="pl.value">{{ pl.label }}</el-radio-button>
                  </el-radio-group>
                  <p class="field-hint">
                    Data is at <code>$INPUT_DIR/<template v-if="port.placement === 'subfolder'">{{ port.name || "&lt;name&gt;" }}/</template></code><template v-if="(port.placement || 'root') === 'root'">, beside any other input placed at the root</template>.
                  </p>
                  <p v-if="rootCollisions.get(port)" class="field-error">
                    Mixes with {{ rootCollisions.get(port).other.name || "another input" }} at the root of INPUT_DIR: {{ rootCollisions.get(port).why }}. Give one of them its own folder.
                  </p>
                  <p v-else-if="port.placement === 'subfolder' && port.name && !/^[a-z0-9][a-z0-9-]*$/.test(port.name)" class="field-error">
                    As a folder name, the name can only have lowercase letters, numbers and dashes.
                  </p>
                </div>
              </div>
              <div v-if="block.key === 'inputs'" class="field-row">
                <label class="field-label">Required</label>
                <div class="field-control">
                  <el-switch v-model="port.required" />
                </div>
              </div>
              <!-- EDAM formats come with the media type; any others the app.yml
                   already had are kept, shown here. -->
              <p v-if="portMode(port) !== 'layout' && extraFormats(port).length" class="field-hint">
                Also from app.yml: {{ extraFormats(port).join(", ") }} (EDAM)
              </p>
            </div>
          </div>

          <button type="button" class="app-outline-button add-row" @click="addPort(block.key)">+ Add {{ block.singular }}</button>
        </div>
      </template>
    </template>

    <!-- ───────────── How it runs: resources and compute types ───────────── -->
    <template v-else-if="part === 'runtime'">
      <component :is="kind === 'interactive' ? MoreOptions : 'div'" v-bind="resourceWrapProps" class="runtime-fields">
        <div class="field-row" data-field="runtime.cpu" :class="rowClass('runtime.cpu')">
          <label class="field-label">CPU</label>
          <div class="field-control">
            <el-select v-model="schema.resources.cpu" placeholder="Choose CPU" class="full" @change="onCpuChange">
              <el-option v-for="opt in STANDARD_CPU_OPTIONS" :key="opt.value" :label="opt.label" :value="Number(opt.value)" />
            </el-select>
            <p v-for="m in at('runtime.cpu')" :key="m" class="field-error">{{ m }}</p>
          </div>
        </div>
        <div class="field-row" data-field="runtime.memory" :class="rowClass('runtime.memory')">
          <label class="field-label">Memory</label>
          <div class="field-control">
            <el-select v-model="schema.resources.memory" :disabled="!schema.resources.cpu" placeholder="Choose CPU first" class="full">
              <el-option v-for="opt in memoryOptions" :key="opt.value" :label="opt.label" :value="Number(opt.value)" />
            </el-select>
            <p v-for="m in at('runtime.memory')" :key="m" class="field-error">{{ m }}</p>
          </div>
        </div>
      </component>

      <!-- Compute types, the advanced part. GPU is one of these; Lambda isn't
           (every image can run there when it fits): the author only opts out. -->
      <more-options :force-open="schema.runtime.computeTypes.length > 1 || schema.runtime.optimize === false || !!at('runtime.computeTypes').length" label="More options">
        <div class="field-row full-width" data-field="runtime.computeTypes" :class="rowClass('runtime.computeTypes')">
          <label class="field-label">Compute types</label>
          <div class="field-control">
            <div class="inline-checks">
              <el-checkbox :model-value="true" disabled>Standard</el-checkbox>
              <el-checkbox :model-value="schema.runtime.computeTypes.includes('gpu')" @change="(c) => toggleComputeType('gpu', c)">
                GPU
              </el-checkbox>
            </div>
            <p v-for="m in at('runtime.computeTypes')" :key="m" class="field-error">{{ m }}</p>
          </div>
        </div>
        <div class="field-row full-width" data-field="runtime.optimize">
          <label class="field-label">Faster runtime <field-hint text="Pennsieve checks each version for whether it fits a faster runtime, such as Lambda. Unchecked runs the app only as its compute types say (optimize: false in app.yml)." /></label>
          <div class="field-control">
            <el-checkbox :model-value="schema.runtime.optimize !== false" @change="(c) => (schema.runtime.optimize = !!c)">
              Let Pennsieve run it on a faster runtime when it fits (Lambda: 15 min, 10 GB)
            </el-checkbox>
          </div>
        </div>
      </more-options>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, toRaw, watch } from "vue";
import { useStore } from "vuex";
import MoreOptions from "./MoreOptions.vue";
import FieldHint from "./FieldHint.vue";
import { PARAM_TYPES, PARAM_TYPE_OPTIONS, createParameter, createPort, portDataTypeOptions, normalizeMediaType, keptFormats, STANDARD_CPU_OPTIONS, getStandardMemoryOptions, isNumericType, mediaTypeMatches, structureId, structureOptionsFor, structureMatches, isStructureLink, conformsToList, rootInputCollisions } from "./applicationSchema";
import { environmentsServiceUrl, findReferences } from "@/utils/environmentsService";
import { useOntologyStore } from "@/stores/ontologyStore";
import { REFERENCE_KINDS, assetClassName, isAppDefault, organismName, referenceBlock, referenceKindText, referenceLabel, taxonFromTerm, rankOrganisms, COMMON_ORGANISMS } from "../RunMonitor/referenceSources";
import DomainTagsInput from "./DomainTagsInput.vue";

/**
 * One part of the app manifest builder's form, bound to an ApplicationSchema
 * (applicationSchema.js) it changes in place; the builder owns it and lays the
 * parts out in its sections.
 */
const schema = defineModel({ type: Object, required: true });

const props = defineProps({
  // Which part: "tags" (About), "io" (What it does: inputs, parameters,
  // outputs), "runtime" (How it runs).
  part: { type: String, required: true },
  // "batch" or "interactive" (manifestBuilder.appKind): an interactive app
  // has no parameters, and its resources are only defaults.
  kind: { type: String, default: "batch" },
  // Problems by the field they point at: { "parameters.0.name": ["…"] }.
  problems: { type: Object, default: () => ({}) },
});

const store = useStore();

const at = (key) => props.problems[key] || [];
const rowClass = (key) => ({ "has-problem": at(key).length > 0 });
const hasValue = (v) => v != null && v !== "";

// The tags, as DomainTagsInput gives them (canonical, one of each).
function setTags(tags) {
  schema.value.tags = tags;
}

/*
  A port's media type is a platform package format, not a vocabulary this form
  invents: the list comes from GET /packages/formats. Types already written
  into the manifest are kept in the list too, so editing an older app.yml
  cannot quietly blank its ports.
*/
onMounted(() => {
  if (props.part === "io") store.dispatch("analysisModule/fetchPackageFormats");
  if (props.part === "io" && (schema.value.inputs || []).some((p) => p.reference)) loadReferenceCatalog();
});

/*
  An input filled from Pennsieve's reference catalog (app.yml reference): the
  author picks a catalog entry and whether runs may choose another, and the
  block is written from the entry, so no identifier is typed. Where the site
  has no catalog, a block the app.yml already had is kept and shown.
*/
const hasReferenceCatalog = !!environmentsServiceUrl();
const referenceEntries = ref([]); // every kind's entries
const referenceCatalogState = ref(""); // "" | loading | loaded | failed
const loadReferenceCatalog = async () => {
  if (!hasReferenceCatalog || referenceCatalogState.value === "loading" || referenceCatalogState.value === "loaded") return;
  referenceCatalogState.value = "loading";
  try {
    const lists = await Promise.all(REFERENCE_KINDS.map((k) => findReferences({ kind: k.kind })));
    referenceEntries.value = lists.flat();
    referenceCatalogState.value = "loaded";
  } catch {
    referenceCatalogState.value = "failed";
  }
};
const referenceGroups = computed(() =>
  REFERENCE_KINDS.map((k) => ({
    ...k,
    entries: referenceEntries.value.filter((e) => e.kind === k.kind).sort((a, b) => referenceLabel(a).localeCompare(referenceLabel(b))),
  })).filter((g) => g.entries.length)
);
// Inputs turned on but with no entry picked yet: nothing is written until one is.
const wantsReference = reactive(new WeakSet());
const showsReference = (port) => !!port.reference || wantsReference.has(toRaw(port));
// What a block written elsewhere restricts, which the form doesn't offer:
// pinning one reference, or the organisms a run may pick from.
const referenceRestriction = (reference) => {
  if (reference?.choice === "app") return "This app.yml pins the reference: runs can't pick another.";
  if (reference?.organisms?.length) return `This app.yml limits runs to ${reference.organisms.map((t) => organismName(t)).join(", ")}.`;
  return "";
};
// The catalog entry an input's block takes by default, if the catalog has it.
const referenceEntryOf = (port) =>
  port.reference ? referenceEntries.value.find((e) => e.kind === (port.reference.kind || "genome") && isAppDefault(e, port.reference)) || null : null;
const pickReference = (port, id) => {
  const entry = referenceEntries.value.find((e) => e.id === id);
  if (!entry) {
    // Cleared: describe it instead, starting from what was there.
    describing.add(toRaw(port));
    return;
  }
  // The app's default; a run may pick any other of its kind.
  port.reference = referenceBlock(entry, { choice: "user" });
  propertyDrafts.delete(toRaw(port));
  // A reference is unpacked into the input's own folder.
  port.placement = "subfolder";
  if (!port.name) port.name = identifierFrom(entry.version?.spec?.assetClass || entry.kind);
  if (!port.description) port.description = referenceLabel(entry);
};

/*
  Describing a reference by hand: its kind, what it is (asset class), and
  its identity, which is the default's (choice user) or the pinned one's.
  Nothing is written until a field has a value.
*/
const describing = reactive(new WeakSet());
const showsDescription = (port) =>
  describing.has(toRaw(port)) ||
  !hasReferenceCatalog ||
  referenceCatalogState.value === "failed" ||
  (!!port.reference && referenceCatalogState.value === "loaded" && !referenceEntryOf(port));
const toggleDescription = (port) => {
  if (describing.has(toRaw(port))) describing.delete(toRaw(port));
  else describing.add(toRaw(port));
};
const referenceOfPort = (port) => {
  if (!port.reference) port.reference = { kind: "genome", assetClass: "", choice: "user" };
  return port.reference;
};
// The identity the description edits (read-only here).
const referenceIdentity = (port) => {
  const r = port.reference;
  if (!r) return {};
  return r.choice === "app" ? r : r.default || {};
};
const writableIdentity = (port) => {
  const r = referenceOfPort(port);
  if (r.choice === "app") return r;
  if (!r.default) r.default = {};
  return r.default;
};
const dropEmptyDefault = (port) => {
  const r = port.reference;
  if (r?.default && !Object.keys(r.default).length) delete r.default;
};
const setReferenceField = (port, field, value) => {
  const r = referenceOfPort(port);
  const v = String(value ?? "").trim();
  if (v) r[field] = v;
  else if (field === "assetClass") r.assetClass = "";
  else delete r[field];
};
const setReferenceKind = (port, kind) => {
  const r = referenceOfPort(port);
  if (r.kind === kind) return;
  r.kind = kind;
  // The other kind's fields don't apply.
  const id = writableIdentity(port);
  if (kind === "template") {
    for (const f of ["taxonomyId", "assembly", "seqcol", "annotation"]) delete id[f];
    delete r.toolVersion;
    delete r.organisms;
  } else {
    delete id.properties;
    propertyDrafts.delete(toRaw(port));
  }
  dropEmptyDefault(port);
};
const setIdentityField = (port, field, value) => {
  const id = writableIdentity(port);
  const v = String(value ?? "").trim();
  if (field === "taxonomyId") {
    const n = Number(v);
    if (v && Number.isInteger(n) && n > 0) id.taxonomyId = n;
    else delete id.taxonomyId;
  } else if (v) id[field] = v;
  else delete id[field];
  dropEmptyDefault(port);
};
const setAnnotation = (port, part, value) => {
  const id = writableIdentity(port);
  const a = { provider: id.annotation?.provider || "", version: id.annotation?.version || "", [part]: String(value ?? "").trim() };
  if (a.provider || a.version) id.annotation = a;
  else delete id.annotation;
  dropEmptyDefault(port);
};
// An identity field's problems, wherever the identity is (the default's, or the pinned one's).
const identityProblems = (port, index, field) =>
  at(`inputs.${index}.reference${port.reference?.choice === "app" ? "" : ".default"}.${field}`);
// Properties are edited as rows, so a name can be typed before its value.
const propertyDrafts = reactive(new WeakMap());
const propertyRows = (port) =>
  propertyDrafts.get(toRaw(port)) || Object.entries(referenceIdentity(port).properties || {}).map(([name, value]) => ({ name, value }));
const writeProperties = (port, rows) => {
  propertyDrafts.set(toRaw(port), rows);
  const id = writableIdentity(port);
  const props = Object.fromEntries(rows.filter((r) => r.name.trim() && r.value.trim()).map((r) => [r.name.trim(), r.value.trim()]));
  if (Object.keys(props).length) id.properties = props;
  else delete id.properties;
  dropEmptyDefault(port);
};
const setPropertyRow = (port, i, change) => writeProperties(port, propertyRows(port).map((r, j) => (j === i ? { ...r, ...change } : r)));
const addPropertyRow = (port) => writeProperties(port, [...propertyRows(port), { name: "", value: "" }]);
const removePropertyRow = (port, i) => writeProperties(port, propertyRows(port).filter((_, j) => j !== i));
/*
  The organism, picked by name from the NCBITaxon ontology (the ontology
  browser's), written as its taxonomy id. A number typed in is taken as an
  id when the ontology can't be searched.
*/
const ontology = useOntologyStore();
const organismResults = ref(COMMON_ORGANISMS);
const organismSearching = ref(false);
const taxonNames = reactive({}); // taxonomy id -> { label, common }
const remember = (taxa) => {
  for (const t of taxa) taxonNames[t.taxonomyId] = { label: t.label, common: t.common };
};
let organismQuery = 0;
const organismTerm = ref(""); // what's typed in the organism search
const searchOrganisms = async (q) => {
  const term = String(q || "").trim();
  organismTerm.value = term;
  const asked = ++organismQuery;
  if (!term) {
    organismResults.value = COMMON_ORGANISMS;
    organismSearching.value = false;
    return;
  }
  organismSearching.value = true;
  let taxa = [];
  try {
    taxa = (await ontology.search(term, { limit: 60, ontologies: ["NCBITaxon"] })).map(taxonFromTerm).filter(Boolean);
  } catch {
    taxa = []; // ontology slices unavailable: an id typed in still works
  }
  if (/^\d+$/.test(term) && !taxa.some((t) => t.taxonomyId === Number(term))) {
    taxa.unshift({ taxonomyId: Number(term), label: taxonNames[term]?.label || `NCBITaxon:${term}`, common: "" });
  }
  if (asked !== organismQuery) return; // a newer search is on its way (and clears the spinner)
  taxa = rankOrganisms(term, taxa).slice(0, 15);
  remember(taxa);
  organismResults.value = taxa;
  organismSearching.value = false;
};
// The search's results, and the organism the input already names (only
// before anything is typed, so it can show as the selected value).
const organismOptions = (port) => {
  const id = referenceIdentity(port).taxonomyId;
  const current =
    id && !organismTerm.value && !organismResults.value.some((o) => o.taxonomyId === id)
      ? [{ taxonomyId: id, label: taxonNames[id]?.label || organismName(id) || `NCBITaxon:${id}`, common: taxonNames[id]?.common || "" }]
      : [];
  return [...current, ...organismResults.value];
};
// Names for the organisms the app.yml already has, from the ontology.
watch(
  () => [...new Set((schema.value.inputs || []).map((p) => Number(referenceIdentity(p).taxonomyId)).filter(Boolean))].join(","),
  async (ids) => {
    for (const id of ids ? ids.split(",") : []) {
      if (taxonNames[id]) continue;
      try {
        const hit = (await ontology.search(`NCBITaxon:${id}`, { limit: 1, ontologies: ["NCBITaxon"] })).map(taxonFromTerm).find((t) => t?.taxonomyId === Number(id));
        if (hit) remember([hit]);
      } catch {
        return;
      }
    }
  },
  { immediate: true }
);

// What it is: the catalog's asset classes of the kind, and the input's own.
const assetClassOptions = (port) => {
  const kind = port.reference?.kind || "genome";
  return [
    ...new Set(
      [...referenceEntries.value.filter((e) => e.kind === kind).map((e) => e.version?.spec?.assetClass), port.reference?.assetClass].filter(Boolean)
    ),
  ];
};

// The media type search, shared by the selects (one is open at a time).
const mediaTypeQuery = ref("");
const portDataTypes = computed(() =>
  portDataTypeOptions(store.state.analysisModule.packageFormats, [
    ...(schema.value.inputs || []).flatMap(portTypes),
    ...(schema.value.outputs || []).flatMap(portTypes),
  ])
);

// In, the app's settings, out: as the app card and the workflow graph
// read. An interactive app has no settings of its own.
const PORT_BLOCKS = {
  inputs: {
    key: "inputs",
    label: "Inputs",
    singular: "input",
    hint: "What the app takes in.",
  },
  outputs: {
    key: "outputs",
    label: "Outputs",
    singular: "output",
    hint: "What the app produces.",
  },
};
const ioBlocks = computed(() =>
  props.kind === "interactive"
    ? [PORT_BLOCKS.inputs, PORT_BLOCKS.outputs]
    : [PORT_BLOCKS.inputs, { key: "parameters" }, PORT_BLOCKS.outputs]
);

// An interactive app's CPU and memory are folded away: they're only defaults.
const resourceWrapProps = computed(() =>
  props.kind === "interactive"
    ? {
        label: "Default CPU and memory (sessions are sized when they start)",
        forceOpen: schema.value.resources.cpu != null || !!at("runtime.cpu").length || !!at("runtime.memory").length,
      }
    : {}
);

const memoryOptions = computed(() => getStandardMemoryOptions(schema.value.resources.cpu));

const onCpuChange = () => {
  // Memory choices depend on CPU; clear a now-invalid selection.
  schema.value.resources.memory = null;
};

const toggleComputeType = (type, checked) => {
  const types = new Set(schema.value.runtime.computeTypes);
  if (checked) types.add(type);
  else types.delete(type);
  // Standard is always supported and is not user-removable.
  types.add("standard");
  schema.value.runtime.computeTypes = Array.from(types);
};

/*
  Parameter names are referenced by the running application, so they must be
  single tokens. Whitespace is stripped as it is typed (or pasted) rather than
  flagged after the fact.
*/
const onParamNameInput = (param, value) => {
  param.name = String(value ?? "").replace(/\s+/g, "");
};

/*
  A port's media types are what the author picks, any number (EDF or NWB).
  Its name and description are the first format's, copied from the option
  the platform served, and `dataType` is kept as the first type. With none,
  the port takes any file and the author names it.
*/
const optionFor = (value) => portDataTypes.value.find((o) => o.value === value);
// The types a port takes: its media types, else an older manifest's dataType.
const portTypes = (port) =>
  asList(port.mediaTypes).length ? asList(port.mediaTypes) : port.dataType && port.dataType !== "any" ? [port.dataType] : [];
// The first folder format among a port's types (OME-Zarr), for the files/folders hint.
const folderFormatOf = (port) => portTypes(port).map(optionFor).find((o) => o?.kind === "directory");
// The EDAM formats a port has beyond its media types' (kept from app.yml).
const extraFormats = (port) => {
  const edams = portTypes(port).map((t) => optionFor(t)?.edam);
  return (port.formats || []).filter((f) => !edams.includes(f));
};
// A format's name as an identifier: "TS-Zarr timeseries" -> ts-zarr-timeseries.
const identifierFrom = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const onPortMediaTypesChange = (port, values) => {
  const previous = portTypes(port);
  const types = [...new Set(asList(values).map(normalizeMediaType).filter((v) => v && v !== "any"))];
  const before = optionFor(previous[0]);
  const option = optionFor(types[0]);
  if (types.length) {
    // The name is the author's identifier: only an empty one, or one the
    // previous first format suggested, follows the first format.
    const suggested = (o) => [identifierFrom(o?.name), o?.name || ""].filter(Boolean);
    if (!port.name || suggested(before).includes(port.name)) port.name = identifierFrom(option?.name);
    if (!port.description || port.description === (before?.description || "")) port.description = option?.description || "";
  }
  port.dataType = types[0] || "any";
  port.mediaTypes = types;
  // EDAM ids aren't written: the registry maps each media type to its own.
  // Ones the app.yml had stay, apart from those of media types taken out,
  // unless the port goes back to any file.
  port.formats = keptFormats(port.formats, previous, types, (t) => optionFor(t)?.edam);
};

/*
  A port is either a file format (a media type) or a whole folder that
  follows a structure (BIDS, app.yml conformsTo). One select offers both.
*/
const structureOptions = computed(() =>
  structureOptionsFor(store.state.analysisModule.packageStructures, [
    ...(schema.value.inputs || []).map((p) => p.conformsTo),
    ...(schema.value.outputs || []).map((p) => p.conformsTo),
  ])
);
/*
  What an input or output is made of at its root, the first thing the card
  asks: files, folders of a folder format (OME-Zarr, as container:
  directory), or one folder with a set layout (BIDS, as conformsTo). The
  mode is read from the port, and remembered while the author hasn't picked
  a format or layout yet.
*/
const PORT_MODES = [
  { value: "file", label: "Files", hint: "Each item is one file: an EDF recording, a DICOM slice, a CSV table. A folder of them is fine; paths are kept." },
  { value: "folder", label: "Folders of a format", hint: "Each item is a folder that is one thing, in a folder format: an .ome.zarr image, a .mefd session." },
  { value: "layout", label: "One folder with a set layout", hint: "One folder tree laid out by a standard, such as BIDS or a Pennsieve published dataset." },
  { value: "reference", label: "Reference data", hint: "A folder whose contents are declared as a published reference, such as a genome index or a brain template, by public identifiers rather than by file type. Pennsieve can fill it from its reference data; otherwise a run takes files." },
];
// Reference data is for inputs.
const portModes = (blockKey) => PORT_MODES.filter((m) => m.value !== "reference" || blockKey === "inputs");
// Where an input's data goes in INPUT_DIR (app.yml placement).
const PLACEMENTS = [
  { value: "root", label: "Root of INPUT_DIR" },
  { value: "subfolder", label: "Its own folder" },
];
const chosenModes = reactive(new WeakMap());
// "Needs a folder format" waits until the author has opened the format list
// and left it empty, rather than appearing the moment Folders is chosen.
const formatTouched = reactive(new WeakSet());
const formatProblems = (port, key) =>
  portMode(port) === "folder" && !portTypes(port).length && !formatTouched.has(toRaw(port)) ? [] : at(key);
const portMode = (port) => {
  if (showsReference(port)) return "reference";
  if (conformsToList(port.conformsTo).length) return "layout";
  if (port.container === "directory") return "folder";
  return chosenModes.get(toRaw(port)) || "file";
};
const setPortMode = (port, mode) => {
  if (portMode(port) === mode) return;
  if (mode === "reference") {
    // No files: the block (once an entry is picked) is all there is.
    wantsReference.add(toRaw(port));
    loadReferenceCatalog();
    chosenModes.delete(toRaw(port));
    port.conformsTo = [];
    port.container = "";
    port.dataType = "any";
    port.mediaTypes = [];
    port.formats = [];
    port.placement = "subfolder";
    return;
  }
  if (portMode(port) === "reference") {
    wantsReference.delete(toRaw(port));
    describing.delete(toRaw(port));
    propertyDrafts.delete(toRaw(port));
    delete port.reference;
  }
  const before = optionFor(portTypes(port)[0]);
  chosenModes.set(toRaw(port), mode);
  port.conformsTo = [];
  port.container = mode === "folder" ? "directory" : "";
  // Formats carry over when they fit: any format as files, a folder
  // format as folders. Otherwise start clean, and drop a name and
  // description that were only the old format's suggestion.
  const fitting = portTypes(port).filter((t) => mode === "file" || optionFor(t)?.kind === "directory");
  if (fitting.length) {
    port.mediaTypes = fitting;
    port.dataType = fitting[0];
    return;
  }
  port.dataType = "any";
  port.mediaTypes = [];
  port.formats = [];
  if (before && port.name === identifierFrom(before.name)) port.name = "";
  if (before && port.description === (before.description || "")) port.description = "";
};
// A file is any format; a folder only a folder format.
const formatChoices = (port) =>
  portMode(port) === "folder"
    ? portDataTypes.value.filter((o) => o.kind === "directory" || portTypes(port).includes(o.value))
    : portDataTypes.value;

const isStructurePort = (port) => portMode(port) === "layout";
// Inputs placed at the root of INPUT_DIR: more than one would mix.
const rootCollisions = computed(() => rootInputCollisions(schema.value.inputs || []));
const structureById = (id) => structureOptions.value.find((o) => o.id === id);
const structureName = (entry) => structureById(structureId(entry))?.name || entry;
// The file that marks a layout's root, for the hint; layouts the builder
// doesn't know get none.
const LAYOUT_ROOT_FILES = {
  bids: "dataset_description.json",
  "pennsieve-published-dataset": "manifest.json",
  "ro-crate": "ro-crate-metadata.json",
};
const layoutRootFile = (entry) => LAYOUT_ROOT_FILES[structureId(entry)] || "";
// The content root of the port's outermost registry layout (files/ for a
// published dataset), when it has one: another layout may start there.
const contentRootOf = (port) => {
  const first = conformsToList(port.conformsTo)[0];
  return first && !isStructureLink(first) ? structureById(structureId(first))?.contentRoot || "" : "";
};
const onLayoutChange = (port, id) => {
  // A layout the app.yml named (bids@1.9, with its nesting) is kept as it was.
  if (structureId(conformsToList(port.conformsTo)[0]) !== id) port.conformsTo = id ? [id] : [];
  if (!contentRootOf(port)) port.conformsTo = port.conformsTo.slice(0, 1);
};
const onInnerStructure = (port, id) => {
  port.conformsTo = id ? [port.conformsTo[0], id] : port.conformsTo.slice(0, 1);
};
const onContainsChange = (port, values) => {
  port.mediaTypes = asList(values).map(normalizeMediaType).filter(Boolean);
  if (!showsContainer(port)) port.container = "";
};
const asList = (v) => (Array.isArray(v) ? v.map(String) : []);
// Folder formats a layout holds: as folders (its default) or as stored.
const showsContainer = (port) =>
  isStructurePort(port) && (port.container === "file" || asList(port.mediaTypes).some((v) => optionFor(v)?.kind === "directory"));
const containerChoice = (port) => port.container || "directory";
const onContainerChange = (port, value) => {
  port.container = value === "directory" ? "" : value;
};

const onParamTypeChange = (param, type) => {
  param.type = type;
  // A default carried over from another type is usually invalid; reset it.
  param.defaultValue = type === PARAM_TYPES.BOOLEAN ? false : null;
  if (type !== PARAM_TYPES.ENUM) param.validValues = [];
  if (!isNumericType(type)) {
    param.min = null;
    param.max = null;
  }
};

const addParameter = () => schema.value.parameters.push(createParameter());
const removeParameter = (i) => schema.value.parameters.splice(i, 1);

const addPort = (key) => schema.value[key].push(createPort({ required: key === "inputs" ? false : undefined }));
const removePort = (key, i) => schema.value[key].splice(i, 1);
</script>

<style scoped lang="scss">
@use "../../../styles/theme";

.application-schema-editor {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.sub-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sub-section-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: theme.$gray_6;
}
.label-helper {
  margin-left: 4px;
  font-size: 12px;
  font-weight: 400;
  color: theme.$gray_4;
}

/* A field: its label above, then the control. */
.field-row {
  display: flex;
  flex-direction: column;
  gap: 4px;

  > .field-label {
    font-size: 13px;
    font-weight: 500;
    color: theme.$gray_6;
  }
}
.field-control {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;

  .full {
    width: 100%;
  }
}
/* A field with a problem: marked, its message under it. */
.has-problem :deep(.el-input__wrapper),
.has-problem :deep(.el-select__wrapper) {
  box-shadow: 0 0 0 1px theme.$red_1 inset;
}
.param-card.has-problem {
  border-color: theme.$red_1;
}
.field-error {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: theme.$red_2;
}
.reference-grid {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 8px 12px;
  align-items: start;
}
.reference-grid-label {
  font-size: 13px;
  line-height: 32px;
  color: theme.$gray_5;
}
.reference-pair {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
}
.reference-summary {
  grid-column: 1 / -1;
  margin-bottom: 8px;
}
.reference-option-meta {
  float: right;
  margin-left: 12px;
  font-size: 12px;
  color: theme.$gray_4;
}
.field-hint {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: theme.$gray_4;

  a {
    color: theme.$purple_3;
  }
}

/* Values the form fills in from the selected package format, not fields. */
.field-static {
  font-size: 13px;
  line-height: 28px;
  color: theme.$gray_6;
  word-break: break-word;

  &.is-empty {
    color: theme.$gray_4;
    font-style: italic;
  }
}

.inline-checks {
  display: flex;
  gap: 20px;
  padding-top: 4px;
}

.runtime-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.param-card {
  padding: 12px 14px 14px;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  background: theme.$gray_1;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.card-title {
  font-size: 13px;
  font-weight: 600;
  color: theme.$gray_6;
}
.link-button {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: theme.$purple_3;
  cursor: pointer;
  text-decoration: underline;
}
.mt-wrap {
  white-space: normal;
  line-height: 1.35;
}
.param-card-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 18px;

  .full-width {
    grid-column: 1 / -1;
  }
}

/* The small outline buttons Applications uses. */
.app-outline-button {
  padding: 3px 10px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  background: theme.$white;
  font: inherit;
  font-size: 12px;
  color: theme.$gray_6;
  cursor: pointer;

  &:hover {
    border-color: theme.$purple_1;
    color: theme.$purple_3;
  }
}
.add-row {
  align-self: flex-start;
}
.mt-option {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
  padding: 4px 0;
}
.mt-name {
  font-size: 13px;
  color: theme.$gray_6;
}
.mt-meta {
  font-size: 11px;
  color: theme.$gray_4;
}
</style>

<style lang="scss">
@use "../../../styles/theme";

/* Options with a description (layouts): as wide as the field, each
   description wrapped to at most two lines. Teleported, so not scoped. */
.described-options .el-select-dropdown__item {
  height: auto;
  padding-top: 4px;
  padding-bottom: 4px;
  line-height: 1.3;
  white-space: normal;

  .mt-wrap {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}
</style>
