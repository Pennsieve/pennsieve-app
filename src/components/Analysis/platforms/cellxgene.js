// CZ CELLxGENE Discover's datasets, from its Census in the Registry of Open
// Data on AWS (utils/cellxgene): several at once, each one .h5ad file.
import { defineAsyncComponent } from "vue";
import cellxgeneMark from "@/assets/images/logos/cellxgene-mark.svg";
import {
  CELLXGENE_REGISTRY,
  cellxgeneViewName,
  cellxgeneFolderName,
  createCellxgeneView,
  countCellxgene,
} from "@/utils/cellxgene";
import { addedSourceName } from "../JupyterSession/inputsHelpers";

export default {
  key: "cellxgene",
  name: "CELLxGENE",
  desc: "Single-cell RNA datasets from CZ CELLxGENE Discover",
  noun: "datasets",
  // Its logo's mark, from its MIT-licensed repository: drawn for its black
  // header.
  mark: { logo: cellxgeneMark, tone: "dark" },
  title: "Choose CELLxGENE datasets",
  intro: [
    "Datasets from ",
    { href: "https://cellxgene.cziscience.com", text: "CZ CELLxGENE Discover" },
    ", read from its Census release in the Registry of Open Data on AWS: as many as you need, each an AnnData .h5ad file. The notebook gets their file list; you pick which to download.",
  ],
  picker: defineAsyncComponent(() => import("../CellxgenePicker.vue")),
  selection: () => ({ picks: [] }),
  ready: (p) => p.picks.length > 0,
  label: (p) => (p.picks.length ? cellxgeneViewName(p.picks) : ""),
  viewName: (p) => cellxgeneViewName(p.picks),
  sameAs: (p, source) => source.openDataset === CELLXGENE_REGISTRY && source.viewName === cellxgeneViewName(p.picks),
  createView: (p) => createCellxgeneView(p.picks),
  folderName: (p, n) => addedSourceName("cellxgene", `${cellxgeneFolderName(p.picks).replaceAll("/", " ")}/`, n),
  count: () => countCellxgene(),
  regions: () => ["us-west-2"],
  size: (p) => p.picks.reduce((n, x) => n + (x.size || 0), 0) || null,
  imaging: () => false,
  publicBucket: true,
  reads: (entry) => entry === CELLXGENE_REGISTRY,
};
