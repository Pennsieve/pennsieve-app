import { fileIcon } from '@/mixins/file-icon/file-icon'

// The Pennsieve file icon (/file-icons/*.svg, as the dataset files table
// shows) for a file known only by its name: a published dataset's file or
// one on a notebook's filesystem. Packages carry their icon key; these
// don't, so it's read off the extension.
const ICON_BY_EXTENSION = {
  csv: 'Tabular', tsv: 'Tabular',
  xls: 'Excel', xlsx: 'Excel',
  json: 'JSON', jsonld: 'JSON',
  xml: 'XML (Code)',
  txt: 'Text', md: 'Text', rtf: 'Text',
  pdf: 'PDF',
  doc: 'Word', docx: 'Word',
  ppt: 'Powerpoint', pptx: 'Powerpoint',
  png: 'Image', jpg: 'Image', jpeg: 'Image', gif: 'Image', bmp: 'Image', svg: 'Image',
  tif: 'Microscope', tiff: 'Microscope', czi: 'Microscope', nd2: 'Microscope', lif: 'Microscope', ome: 'Microscope',
  mp4: 'Video', mov: 'Video', avi: 'Video', mkv: 'Video', webm: 'Video',
  edf: 'Timeseries', bdf: 'Timeseries', mef: 'Timeseries', mefd: 'Timeseries', nev: 'Timeseries', ns5: 'Timeseries',
  nii: 'ClinicalImageBrain', dcm: 'ClinicalImageBrain', mgz: 'ClinicalImageBrain',
  mat: 'Matlab', m: 'Matlab',
  ipynb: 'Notebook',
  rdata: 'RData (R logo)', rds: 'RData (R logo)',
  py: 'Code', r: 'Code', js: 'Code', sh: 'Code', c: 'Code', cpp: 'Code', java: 'Code',
  zip: 'Zip', gz: 'Zip', tgz: 'Zip', tar: 'Zip', bz2: 'Zip', '7z': 'Zip',
  vcf: 'Genomics Variant', bam: 'Genomics', sam: 'Genomics', fastq: 'Genomics', fasta: 'Genomics', fa: 'Genomics',
  obj: 'Model (xyz coordinates)', stl: 'Model (xyz coordinates)',
}

export function fileIconForPath(name, { folder = false } = {}) {
  if (folder) return fileIcon('', 'Collection')
  const base = (name || '').split('/').pop().toLowerCase()
  const dot = base.lastIndexOf('.')
  const ext = dot > 0 ? base.slice(dot + 1) : ''
  return fileIcon(ICON_BY_EXTENSION[ext] || 'Generic', '')
}
