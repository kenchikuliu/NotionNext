// English-only replacement for the existing ComfyUI beginner article.
export const comfyuiId = '13e00092-b977-8190-a9bc-c76fc64da38a'
export const comfyuiSlug = 'article/comfyui'
export const comfyuiModified = '2026-10-25T07:45:45.236Z'
export const comfyuiEnhancement = {
  seoTitle: 'ComfyUI Beginner Guide: Install and Run Your First Workflow',
  seoDescription:
    'Choose Comfy Desktop or Windows Portable, load your first text-to-image workflow, find model folders, share WebUI models, and fix common errors.',
  heroSummary:
    'Get from a new ComfyUI installation to a saved first workflow, with official downloads, model-folder guidance, and a practical troubleshooting table.',
  intentTitle: 'Start with one working text-to-image workflow',
  intentText:
    'Choose an installation for your computer, load the official beginner example, check its model, and run it before adding extensions or complex workflows.',
  faqItems: [
    {
      question: 'What is the easiest way to install ComfyUI?',
      answer:
        'Start with the official Comfy Desktop guide for your operating system. Windows users who prefer an extracted folder and bundled Python can use the official Portable package matching their GPU. Check the current platform requirements before downloading.'
    },
    {
      question: 'Does a ComfyUI workflow include its models?',
      answer:
        'A workflow JSON describes nodes, settings, and connections. It does not contain the checkpoint weights. Install the exact models named by the workflow in the appropriate model folders, then refresh the model list or restart.'
    },
    {
      question: 'Why is Load Checkpoint empty or showing null?',
      answer:
        'Check that the requested checkpoint finished downloading, is in the active installation’s models/checkpoints folder or a configured search path, and has not been left inside an archive. Refresh or restart ComfyUI, then select the checkpoint again.'
    },
    {
      question: 'Can ComfyUI share models with Stable Diffusion WebUI?',
      answer:
        'Yes. Portable and manual installations can use extra_model_paths.yaml to add WebUI model directories. Desktop model locations can be managed through its storage controls; configuration details vary by version. Shared storage does not make a model compatible with every workflow.'
    }
  ]
}
const link = (label, href) => [label, [['a', href]]]
const text = value => ({ type: 'text', title: [[value]] })
const heading = value => ({ type: 'header', title: [[value]] })
const subheading = value => ({ type: 'sub_header', title: [[value]] })
const image = (name, alt) => ({
  type: 'image',
  source: `https://www.charliiai.com/images/comfyui/${name}.svg`,
  alt
})
const source = (label, href) => ({ type: 'text', title: [link(label, href)] })
export const comfyuiContent = [
  text(
    'ComfyUI turns image-generation tasks into connected nodes: load a model, encode a prompt, sample an image, decode it, and save the result. For your first session, use the official text-to-image example and its matching checkpoint. Get that small workflow working before importing a graph with dozens of unfamiliar extensions.'
  ),
  text(
    'This guide follows the official installation, first-generation, and node documentation checked on October 25, 2026. Menu labels and supported hardware can change. The diagrams explain the workflow; they are not screenshots or generated-image benchmarks.'
  ),
  { type: 'toc' },
  heading('1. Choose an official ComfyUI installation'),
  text(
    'Choose the package for your operating system and hardware. A desktop launcher, an extracted portable folder, and a manual Python environment are different installation routes. Instructions for one do not always apply to the others.'
  ),
  {
    type: 'table',
    rows: [
      ['Route', 'When it fits', 'First step'],
      [
        'Comfy Desktop',
        'A managed local setup on a supported platform',
        'Follow the official guide for your OS; choose local installation during setup'
      ],
      [
        'Windows Portable',
        'An extracted folder with its own Python environment',
        'Choose the GPU package on the official Portable page and read its included README'
      ],
      [
        'Manual installation',
        'Linux, a custom environment, or direct dependency control',
        'Use a separate Python environment and the official hardware-specific dependency instructions'
      ]
    ]
  },
  image(
    'installation-choice',
    'Choose Desktop for managed installation, Windows Portable for an extracted package, or manual installation for environment control.'
  ),
  text(
    'On Windows, download the official Desktop installer and follow its setup prompts. On an Apple Silicon Mac, use the official macOS Desktop guide. Check current operating-system and hardware requirements at those links instead of assuming every computer can use the same build. For a local first run, select the local installation option rather than a hosted service.'
  ),
  source(
    'Official Windows Desktop installation',
    'https://docs.comfy.org/installation/desktop/windows'
  ),
  source(
    'Official macOS Desktop installation',
    'https://docs.comfy.org/installation/desktop/macos'
  ),
  text(
    'For Windows Portable, extract the complete archive with 7-Zip. Use the launcher supplied for your selected GPU package: the NVIDIA package documents run_nvidia_gpu.bat, while other packages have their own launchers. Keep the terminal open while ComfyUI runs. When it reports http://127.0.0.1:8188, open that address if a browser has not opened automatically. Do not install a second system Python just to launch the embedded-Python package.'
  ),
  source(
    'Official Windows Portable packages and launch instructions',
    'https://docs.comfy.org/installation/comfyui_portable_windows'
  ),
  text(
    'For a manual install, create an isolated environment, clone the official repository, and follow the current dependency commands for your hardware. Avoid copying a CUDA command onto a different GPU platform. Once dependencies are ready, the manual guide starts ComfyUI with python main.py. Use that guide for driver and Python details rather than mixing several older tutorials.'
  ),
  source(
    'Official manual installation guide',
    'https://docs.comfy.org/installation/manual_install'
  ),
  heading('2. Load the official beginner workflow and its model'),
  text(
    'Open the official first-generation guide linked below. It provides a text-to-image workflow JSON and an example image carrying workflow metadata. Download the JSON, then use Workflows → Open in ComfyUI. You can also drag an image with intact ComfyUI workflow metadata onto the canvas. An ordinary screenshot or a recompressed image may not carry that data.'
  ),
  source(
    'Open the official first-generation guide and example workflow',
    'https://docs.comfy.org/get_started/first_generation'
  ),
  text(
    'The documented beginner example uses v1-5-pruned-emaonly-fp16.safetensors. Follow the model link in the official guide or the missing-model prompt. A workflow file does not include model weights, and installing ComfyUI does not mean every model is already installed. Confirm the download has finished and review the model’s license before using its output in a project.'
  ),
  text(
    'For Portable, this checkpoint belongs in ComfyUI_windows_portable/ComfyUI/models/checkpoints. For a manual install, use models/checkpoints inside the active ComfyUI directory. In Desktop, open the model/storage controls for the active installation to find its model directory. Download behavior differs between versions: if your browser saves a file to Downloads, move it into the correct folder yourself.'
  ),
  text(
    'Refresh the model definitions or restart ComfyUI, then choose the downloaded file in Load Checkpoint. Do not put a standalone diffusion model, a LoRA, or a text encoder in that dropdown and expect it to behave like the example checkpoint. Other model families can require separate loaders and different workflows.'
  ),
  heading('3. Understand the nodes before pressing Run'),
  image(
    'first-workflow',
    'Checkpoint and prompt encoding feed KSampler with an empty latent image; VAE Decode turns the sampled latent into pixels for Save Image.'
  ),
  {
    type: 'table',
    rows: [
      ['Node', 'Job in the beginner graph', 'What to check'],
      [
        'Load Checkpoint',
        'Loads the model, text encoder, and VAE supplied by this checkpoint',
        'The selected checkpoint matches the example'
      ],
      [
        'CLIP Text Encode × 2',
        'Turns positive and negative prompts into conditioning',
        'Both use the checkpoint’s CLIP output'
      ],
      [
        'Empty Latent Image',
        'Sets the starting image dimensions and batch size',
        'Start with the example dimensions and one image'
      ],
      [
        'KSampler',
        'Samples a latent using the model, conditioning, seed, and settings',
        'All required inputs are connected'
      ],
      [
        'VAE Decode → Save Image',
        'Converts the latent to pixels and saves the image',
        'Decode receives the VAE and Save Image receives IMAGE data'
      ]
    ]
  },
  text(
    'Start with the example’s settings. Change the positive prompt to a simple subject such as “a ceramic mug on a wooden desk, soft window light.” Keep dimensions, sampler settings, and batch size unchanged for the first run. Click Run, or use the shortcut shown in your version. Older tutorials may call the action Queue Prompt.'
  ),
  text(
    'Wait for the result in Save Image, then save a local copy and export the workflow JSON from Workflows → Export. Give it a descriptive name and note the checkpoint filename. To compare prompts, keep the seed fixed and change one phrase at a time; settings that randomize the seed will change the result too. The same seed is useful for controlled comparisons, but is not a guarantee of identical output across software or hardware changes.'
  ),
  source(
    'Official node types, connections, and missing-node explanations',
    'https://docs.comfy.org/basic-concepts/nodes'
  ),
  heading('4. Share existing WebUI models without duplicating them'),
  text(
    'Portable and manual installations include extra_model_paths.yaml.example in the ComfyUI directory. Copy it as extra_model_paths.yaml and edit a copy after backing up existing configuration. The following abbreviated example assumes your WebUI installation is D:/stable-diffusion-webui. Replace that path with your own; use spaces for indentation.'
  ),
  {
    type: 'quote',
    title: [
      [
        'a1111:\n  base_path: D:/stable-diffusion-webui/\n  checkpoints: models/Stable-diffusion\n  vae: models/VAE\n  loras: models/Lora'
      ]
    ]
  },
  text(
    'Restart ComfyUI after saving the configuration. If the checkpoint still does not appear, check the actual file location and the base_path rather than downloading another copy immediately. Desktop has its own storage controls and version-specific configuration locations; preserve the paths it created during setup. Sharing a directory saves duplicate storage but does not convert model formats or add missing workflow nodes.'
  ),
  source(
    'Official extra_model_paths.yaml example',
    'https://raw.githubusercontent.com/Comfy-Org/ComfyUI/master/extra_model_paths.yaml.example'
  ),
  heading('5. Fix the first error before adding more nodes'),
  image(
    'troubleshooting-order',
    'Troubleshoot in order: match the requested model, check node inputs and packages, then reduce memory demand if needed.'
  ),
  {
    type: 'table',
    rows: [
      ['Symptom', 'First check', 'Next action'],
      [
        'Load Checkpoint is empty or null',
        'File location, completed download, active installation',
        'Refresh or restart; select the model again'
      ],
      [
        'A node is marked missing',
        'Whether it is a core node or a third-party extension',
        'Update for a newer core node; review the extension’s source and dependencies before installing it'
      ],
      [
        'An input is marked red',
        'Missing input or incompatible connection type',
        'Reconnect the matching data type using the example graph'
      ],
      [
        'Out-of-memory error',
        'Image dimensions, batch size, and model requirements',
        'Try one image at the example size; close other GPU-heavy tasks'
      ],
      [
        'Browser cannot reach the local interface',
        'Whether the launcher is still running',
        'Read the terminal error and use the URL it actually reports'
      ]
    ]
  },
  text(
    'If an imported workflow fails, return to the official beginner example. If that works, compare the new workflow’s models and node packages with your working baseline. Avoid installing every suggested extension at once: each package can add code and dependencies. Save a working workflow and configuration before updates so you can identify what changed.'
  ),
  heading('6. Save a repeatable first workflow'),
  text(
    'Your first milestone is a workflow you can reopen: the intended checkpoint is selected, required inputs are connected, an image appears in Save Image, and the exported JSON loads again. Keep the model filename and a note of your installation route alongside it. Then explore one feature at a time, such as a different prompt or an image-to-image example for a compatible model.'
  ),
  source('Browse more CharliiAI practical guides', '/en-US'),
  heading('Frequently asked questions'),
  ...comfyuiEnhancement.faqItems.flatMap(item => [
    subheading(item.question),
    text(item.answer)
  ])
]

export function isComfyuiPost(post) {
  return (
    post?.id === comfyuiId &&
    [comfyuiSlug, `en-US/${comfyuiSlug}`].includes(post?.slug)
  )
}

export function createComfyuiRecordMap(original = {}) {
  const root = structuredClone(
    original.block?.[comfyuiId] || {
      value: {
        id: comfyuiId,
        type: 'page',
        space_id: 'c752906a-628f-4e18-b232-6039094f831a'
      }
    }
  )
  root.value.content = []
  const block = { [comfyuiId]: root }
  let sequence = 0
  const add = (type, properties, parent = comfyuiId, extra = {}) => {
    const id = `cf251025-0000-4000-8000-${String(++sequence).padStart(12, '0')}`
    block[id] = {
      value: {
        id,
        type,
        parent_id: parent,
        parent_table: 'block',
        properties,
        ...extra
      }
    }
    return id
  }
  for (const item of comfyuiContent) {
    let id
    if (item.type === 'table') {
      const columns = ['tool', 'fit', 'check']
      id = add('table', {}, comfyuiId, {
        content: [],
        format: {
          table_block_column_order: columns,
          table_block_column_format: {},
          table_block_row_header: false,
          table_block_column_header: true
        }
      })
      for (const row of item.rows) {
        block[id].value.content.push(
          add(
            'table_row',
            Object.fromEntries(columns.map((key, i) => [key, [[row[i]]]])),
            id
          )
        )
      }
    } else if (item.type === 'image') {
      id = add(
        'image',
        {
          source: [[item.source]],
          caption: [[item.alt]],
          alt_text: [[item.alt]]
        },
        comfyuiId,
        { format: { block_width: 900, display_source: item.source } }
      )
    } else {
      id = add(item.type === 'toc' ? 'table_of_contents' : item.type, {
        title: item.title || [],
        ...(item.language ? { language: [[item.language]] } : {})
      })
    }
    root.value.content.push(id)
  }
  return { ...original, block }
}

export function applyComfyuiEditorial(props, locale = props?.pageLocale) {
  if (locale !== 'en-US' || !isComfyuiPost(props?.post)) return false
  const post = props.post
  post.blockMap = createComfyuiRecordMap(post.blockMap)
  post.title = comfyuiEnhancement.seoTitle
  post.summary = comfyuiEnhancement.seoDescription
  post.seoEnhancement = comfyuiEnhancement
  post.intentRelatedLinks = []
  post.lastEditedDate = comfyuiModified
  post.lastEditedDay = '2026-10-25'
  return true
}
