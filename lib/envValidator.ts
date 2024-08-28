import { EC2Props } from '../bin/ec2-instanceApp';

export enum InstanceSize {
  'MICRO' = 'micro',
  'LARGE' = 'large',
}
export enum CPUTypes {
  'X86_64' = 'x86_64',
  'ARM64' = 'arm64',
}

export function envValidator(props: EC2Props) {
  const validCpuTypes = Object.keys(CPUTypes).join(', ');
  if (props.cpuType) {
    if (props.cpuType !== 'X86_64' && props.cpuType !== 'ARM64') {
      throw new Error(
        `Invalid CPU type.  Valid CPU Types are ${validCpuTypes}`,
      );
    }
  }

  if (props.instanceSize) {
    const validSizes = Object.keys(InstanceSize).join(', ');
    if (
      !Object.values(InstanceSize).includes(
        props.instanceSize.toLowerCase() as InstanceSize,
      )
    ) {
      throw new Error(`Invalid instance size. Valid sizes are: ${validSizes}`);
    }
  }
}