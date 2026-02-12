import React from 'react';

const A2UIRenderer = ({ blueprint, onAction }) => {
  if (!blueprint || !blueprint.root) {
    return <div className="p-4 text-slate-400 italic text-center">Empty App Blueprint</div>;
  }

  // This function recursively builds ANY HTML structure the AI wants
  const renderElement = (node, index) => {
    if (!node) return null;

    // 1. Tag Name (e.g., "div", "button", "h1")
    const Tag = node.tag || 'div';
    
    // 2. Props (className, onClick, etc.)
    const props = {
      key: index,
      className: node.props?.className || "",
      // If it's an image
      src: node.props?.src,
      alt: "App content",
      // If it's an input
      placeholder: node.props?.placeholder,
      defaultValue: node.props?.value,
      // If it has an action, wire it up
      onClick: node.props?.onClick ? () => onAction(node.props.onClick, "click") : undefined,
      onKeyDown: (e) => {
        if (e.key === 'Enter' && node.props?.onClick) {
           onAction(node.props.onClick, e.target.value);
        }
      }
    };

    // 3. Children (Text or nested elements)
    let children = null;
    
    // If it has direct text content
    if (node.props?.text) {
      children = node.props.text;
    } 
    // If it has nested children
    else if (node.children && node.children.length > 0) {
      children = node.children.map((child, i) => renderElement(child, i));
    }

    // 4. Create the element
    return React.createElement(Tag, props, children);
  };

  return (
    <div className="w-full animate-in fade-in zoom-in-95 duration-500">
      {renderElement(blueprint.root, 0)}
    </div>
  );
};

export default A2UIRenderer;
