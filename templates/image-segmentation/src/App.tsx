// tslint:disable
import * as React from 'react';
import './App.css';
import './icons.css';
import { MuiThemeProvider } from 'material-ui/styles';
import { createMuiTheme } from 'material-ui/styles';
import lightblue from 'material-ui/colors/blue';
import { LabelingScreen } from './labeling-screen/labeling-screen';
import { Toolbar } from './toolbar/toolbar';
import { getSizeOnImage } from './utils/image-size';
import { ToolNames } from './labeling-screen/segment-image';
import { keyComboStream, keyDownSteam } from './key-binding-helpers';

export const primary = '#5495e3';
export const theme = createMuiTheme({
  palette: {
    primary: {
      ...lightblue,
      A700: primary
    }
  }
});

interface AnnotationsByTool {
  [key: string]: {x: number, y: number}[][];
}

type Tool = {name: string, color: string, tool: ToolNames};
const tools: Tool[] = [
  {name: 'Vegetation', color: 'pink', tool: 'polygon'},
  {name: 'Paved Road', color: 'purple', tool: 'polygon'},
  {name: 'Buildings', color: 'orange', tool: 'rectangle'},
  {name: 'Sidewalk', color: 'green', tool: 'line'},
];

function selectToolbarState(currentTools: Tool[], annotationsByTool: AnnotationsByTool, hiddenTools: number[]) {
  return currentTools
    .map(({name, color, tool}, index) => {
      return {
        name,
        color,
        tool,
        count: annotationsByTool[index] ? annotationsByTool[index].length : 0,
        visible: hiddenTools.indexOf(index) === -1
      };
    });
}

// TODO write test for this function
function selectAnnotations(
  currentTools: Tool[],
  annotationsByTool: AnnotationsByTool,
  hiddenTools: number[],
  currentlyEditingShape: undefined | {
    toolName: ToolNames,
    index: number
  }
) {
  const mergeAnnotationsAndTools = (allAnnotations: AnnotationsByTool, {tool, color}: Tool, index: number) => {
    if (hiddenTools.indexOf(index) !== -1) {
      return allAnnotations;
    }

    const isShapeBeingEdited = currentlyEditingShape && tool === currentlyEditingShape.toolName && index === currentlyEditingShape.index;
    const annotations = annotationsByTool[index] ?
      annotationsByTool[index].map((bounds) => ({color, bounds, editing: isShapeBeingEdited})) :
      [];
    const differentColorWithSameTool = allAnnotations[tool as string] ? allAnnotations[tool as string] : [];
    return Object.assign(allAnnotations, {[tool as string]: [...differentColorWithSameTool, ...annotations]});
  };
  return currentTools.reduce(mergeAnnotationsAndTools, {});
}

class App extends React.Component {
  public state: {
    imageInfo: {url: string, height: number, width: number} | undefined,
    currentToolIndex: number | undefined,
    annotationsByTool: AnnotationsByTool,
    hiddenTools: number[],
    currentlyEditingShape?: {
      toolName: ToolNames,
      index: number
    },
  } = {
    imageInfo: undefined,
    currentToolIndex: 0,
    annotationsByTool: {},
    hiddenTools: [],
  };

  componentWillMount () {
    this.next();

    // TODO kinda of of a hack to have this function here
    const clickDeleteLastPoint = () => {
      const selector = '.leaflet-draw-actions a[title="Delete last point drawn"]';
      const undo: HTMLElement | null = document.querySelector(selector);
      if (undo) {
        undo.click();
      }
    };
    keyComboStream(['cmd', 'ctrl', 'space'], 'z').subscribe(clickDeleteLastPoint);

    keyDownSteam('space').subscribe(() => {
      this.setState({...this.state, currentToolIndex: undefined});
    });

  }

  next(label?: string) {
    const getNext = () => {
      // tslint:disable-next-line
      (window as any).Labelbox.fetchNextAssetToLabel()
        .then((imageUrl: string) => {
          const updateImageInfo = ({height, width}: {height: number, width: number}) => {
            this.setState({...this.state, imageInfo: {width, height, url: imageUrl}});
          };
          getSizeOnImage(imageUrl).then(updateImageInfo);
        });
    };
    if (label) {
      // tslint:disable-next-line
      (window as any).Labelbox.setLabelForAsset(label).then(getNext);
    } else {
      getNext();
    }
  }

  render() {
    console.log('new state', this.state);
    const onNewAnnotation = (annotation: {x: number, y: number}[]) => {
      if (this.state.currentToolIndex === undefined) {
        throw new Error('should not be able to add an annotation without a tool');
      }
      this.setState({
        ...this.state,
        annotationsByTool: {
          ...this.state.annotationsByTool,
          [this.state.currentToolIndex]: [
            ...(this.state.annotationsByTool[this.state.currentToolIndex] || []),
            annotation
          ]
        }
      });
    };

    const toggleVisiblityOfTool = (toolIndex: number) => {
      const removeItem = (arr: number[], index: number) => [ ...arr.slice(0, index), ...arr.slice(index + 1) ];
      const currentHiddenTools = this.state.hiddenTools || [];
      const foundIndex = currentHiddenTools.indexOf(toolIndex);
      const hiddenTools = foundIndex === -1 ?
        [...currentHiddenTools, toolIndex] :
        removeItem(currentHiddenTools, foundIndex);

      this.setState({...this.state, hiddenTools});
    };

    const editShape = (toolName: ToolNames, index?: number) => {
      this.setState({
        ...this.state,
        currentlyEditingShape: toolName !== undefined && index !== undefined ? {toolName, index} : undefined
      });
    }

    const onAnnotationEdit = (toolName: ToolNames, annotationIndex: number, updatedValue: {x: number, y: number}[]) => {
      if (toolName === undefined){
        throw new Error('Cant edit a polygon that wasnt made with a tool');
      }
      // TODO need to make this an id
      // If someone make one annotation
      // make a second annotation
      // then delets the first one
      // updates the second one
      // This function will error bause the annotationIndex has changed
      // Thats why I should use an ID
      console.log(this.state.annotationsByTool);
      console.log(toolName);
      const tool = tools.find(({tool}) => tool === toolName)
      if (!tool) {
        throw new Error(`tool not found ${toolName}`);
      }
      const toolIndex = tools.indexOf(tool);
      this.setState({
        ...this.state,
        annotationsByTool: {
          ...this.state.annotationsByTool,
          [toolIndex]: [
            this.state.annotationsByTool[toolIndex].slice(0, annotationIndex),
            updatedValue,
            this.state.annotationsByTool[toolIndex].slice(annotationIndex+1),
          ]
        }
      });
      console.log('so happy', toolName, annotationIndex, updatedValue);
    };

    return (
      <MuiThemeProvider theme={theme}>
        <div className="app">
          <div className="content">
            <div className="sidebar">
              <div className="header logo">Labelbox</div>
              <Toolbar
                tools={selectToolbarState(tools, this.state.annotationsByTool, this.state.hiddenTools)}
                currentTool={this.state.currentToolIndex}
                toolChange={(currentToolIndex: number) => this.setState({...this.state, currentToolIndex})}
                visibilityToggle={toggleVisiblityOfTool}
              />
            </div>
            <div className="labeling-frame">
              <div className="header">Outline all listed objects</div>
              <LabelingScreen
                imageInfo={this.state.imageInfo}
                annotations={selectAnnotations(tools, this.state.annotationsByTool, this.state.hiddenTools, this.state.currentlyEditingShape)}
                onSubmit={(label: string) => this.next(label)}
                drawColor={this.state.currentToolIndex !== undefined ? tools[this.state.currentToolIndex].color : undefined}
                onNewAnnotation={onNewAnnotation}
                selectedTool={this.state.currentToolIndex !== undefined ? tools[this.state.currentToolIndex].tool : undefined}
                editShape={editShape}
                isEditing={Boolean(this.state.currentlyEditingShape)}
                onAnnotationEdit={onAnnotationEdit}
              />
            </div>
          </div>
        </div>
      </MuiThemeProvider>
    );
  }
}

export default App;
